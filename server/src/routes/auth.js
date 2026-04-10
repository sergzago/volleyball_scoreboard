/**
 * Маршруты для аутентификации
 * Поддерживает Firebase и PocketBase
 *
 * Управление пользователями осуществляется через:
 * - Firebase Console (Firebase Auth)
 * - PocketBase Admin Dashboard (/_/)
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Загружаем credentials для Firebase API key
let firebaseApiKey = null;
try {
  const credentials = require('../../credentials.js');
  firebaseApiKey = credentials?.firebase?.apiKey || process.env.FIREBASE_API_KEY;
} catch {
  firebaseApiKey = process.env.FIREBASE_API_KEY;
}

const USERS_COLLECTION = process.env.POCKETBASE_USERS_COLLECTION || 'scoreusers';

/**
 * POST /api/auth/login
 * Войти по username/email и паролю, получить токен
 */
router.post('/login', async (req, res) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Требуется identity и password'
      });
    }

    const dbConfig = req.app.locals.db;

    if (dbConfig.provider === 'firebase') {
      // Firebase: получаем ID token через Google Identity Toolkit API
      const email = identity.includes('@') ? identity : `${identity.toLowerCase()}@volleyball.local`;

      const response = await fetch(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        let message = 'Неверные учётные данные';
        if (error.error?.message === 'INVALID_LOGIN_CREDENTIALS') {
          message = 'Пользователь не найден или неверный пароль';
        } else if (error.error?.message === 'USER_DISABLED') {
          message = 'Учётная запись заблокирована';
        } else if (error.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          message = 'Слишком много попыток входа. Попробуйте позже';
        }
        return res.status(401).json({ error: 'Unauthorized', message });
      }

      const data = await response.json();

      // Получаем роль пользователя из Firestore
      let role = 'user';
      const username = email.split('@')[0];
      try {
        const userDoc = await dbConfig.db
          .collection(process.env.FIREBASE_USERS_COLLECTION || 'users')
          .doc(username)
          .get();
        if (userDoc.exists && userDoc.data().role) {
          role = userDoc.data().role;
        }
      } catch {
        // Роль по умолчанию — 'user'
      }

      res.json({
        token: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: parseInt(data.expiresIn, 10),
        user: {
          uid: data.localId,
          email: data.email,
          username,
          role,
          displayName: data.displayName || username
        }
      });

    } else if (dbConfig.provider === 'pocketbase') {
      // PocketBase: авторизуемся через коллекцию scoreusers
      const pb = dbConfig.client;
      let authData;

      // Пробуем войти по username
      try {
        authData = await pb.collection(USERS_COLLECTION).authWithPassword(identity.toLowerCase(), password);
      } catch {
        // Fallback: пробуем по email
        const email = identity.includes('@') ? identity : `${identity.toLowerCase()}@volleyball.local`;
        authData = await pb.collection(USERS_COLLECTION).authWithPassword(email, password);
      }

      res.json({
        token: authData.token,
        refreshToken: authData.token, // PocketBase использует один токен
        expiresIn: 604800, // 7 дней (стандарт PocketBase)
        user: {
          uid: authData.record.id,
          email: authData.record.email,
          username: authData.record.username || authData.record.email.split('@')[0],
          role: authData.record.role || 'user',
          displayName: authData.record.name || authData.record.username || identity
        }
      });

    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unknown database provider'
      });
    }
  } catch (error) {
    console.error('Login error:', error.message);

    let message = 'Неверные учётные данные';
    if (error.message?.includes('Failed to authenticate')) {
      message = 'Пользователь не найден или неверный пароль';
    }

    res.status(401).json({
      error: 'Unauthorized',
      message
    });
  }
});

/**
 * GET /api/auth/me
 * Получить информацию о текущем пользователе
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      user: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        claims: req.user.claims
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/token
 * Получить информацию о текущем токене
 */
router.post('/token', requireAuth, async (req, res) => {
  try {
    res.json({
      message: 'Используйте токен из заголовка Authorization',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
