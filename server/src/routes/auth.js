/**
 * Маршруты для аутентификации
 * Поддерживает Firebase (через Firestore) и PocketBase
 *
 * Управление пользователями осуществляется через:
 * - Firebase: коллекция users в Firestore
 * - PocketBase Admin Dashboard (/_/)
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function verifyPasswordServer(password, stored) {
  const parts = stored.split(':');
  const salt = Buffer.from(parts[0], 'hex');
  const hash = parts[1];
  return new Promise(function(resolve, reject) {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, function(err, derived) {
      if (err) return reject(err);
      resolve(derived.toString('hex') === hash);
    });
  });
}

// Загружаем credentials для Firebase API key
let firebaseApiKey = null;
try {
  const credentials = require('../../credentials.js');
  firebaseApiKey = credentials?.firebase?.apiKey || process.env.FIREBASE_API_KEY;
} catch {
  firebaseApiKey = process.env.FIREBASE_API_KEY;
}

const USERS_COLLECTION = process.env.POCKETBASE_USERS_COLLECTION || 'scoreusers';

let pbReaderClient = null;

async function getPbReaderClient() {
  if (pbReaderClient) return pbReaderClient;

  const PocketBase = require('pocketbase').default;
  let pbUrl = process.env.POCKETBASE_URL;
  if (!pbUrl) {
    try {
      const creds = require('../../../credentials.js');
      if (creds.pocketbase && creds.pocketbase.url) pbUrl = creds.pocketbase.url;
    } catch {}
  }
  pbUrl = pbUrl || 'http://localhost:8090';

  let userEmail, userPassword;
  try {
    const creds = require('../../../credentials.js');
    userEmail = creds.pocketbase?.user_email;
    userPassword = creds.pocketbase?.user_password;
  } catch {}

  if (!userEmail || !userPassword) return null;

  pbReaderClient = new PocketBase(pbUrl);
  try {
    await pbReaderClient.collection('app_users').authWithPassword(userEmail, userPassword);
  } catch {
    pbReaderClient = null;
  }
  return pbReaderClient;
}

async function getPbUserById(userId) {
  const client = await getPbReaderClient();
  if (!client) return null;
  try {
    return await client.collection(USERS_COLLECTION).getOne(userId);
  } catch {
    return null;
  }
}

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
      const username = identity.includes('@') ? identity.split('@')[0].toLowerCase() : identity.toLowerCase();
      const usersCollection = process.env.FIREBASE_USERS_COLLECTION || 'users';

      const userDoc = await dbConfig.db
        .collection(usersCollection)
        .doc(username)
        .get();

      if (!userDoc.exists || !userDoc.data().password) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Пользователь не найден или неверный пароль' });
      }

      const userData = userDoc.data();
      const valid = await verifyPasswordServer(password, userData.password);

      if (!valid) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Пользователь не найден или неверный пароль' });
      }

      const { v4: uuidv4 } = require('uuid');
      const token = uuidv4();
      const sessionsCollection = process.env.FIREBASE_SESSIONS_COLLECTION || 'sessions';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await dbConfig.db.collection(sessionsCollection).doc(token).set({
        uid: userDoc.id,
        email: userData.email,
        role: userData.role || 'user',
        expiresAt: expiresAt,
        createdAt: new Date()
      });

      res.json({
        token: token,
        refreshToken: token,
        expiresIn: 604800,
        user: {
          uid: userDoc.id,
          email: userData.email,
          username: username,
          role: userData.role || 'user',
          displayName: userData.displayName || username
        }
      });

    } else if (dbConfig.provider === 'pocketbase') {
      // PocketBase: авторизуемся через коллекцию scoreusers
      // Создаём отдельный клиент БЕЗ admin-сессии для user-auth,
      // чтобы токен админа не конфликтовал с авторизацией пользователя
      const PocketBase = require('pocketbase').default;
      let pbUrl = process.env.POCKETBASE_URL;
      if (!pbUrl) {
        try {
          const creds = require('../../../credentials.js');
          if (creds.pocketbase && creds.pocketbase.url) pbUrl = creds.pocketbase.url;
        } catch {}
      }
      pbUrl = pbUrl || 'http://localhost:8090';
      const userClient = new PocketBase(pbUrl);
      let authData;

      // Пробуем войти по username (как делает фронтенд — сначала username, потом email)
      try {
        const username = identity.includes('@') ? identity.split('@')[0].toLowerCase() : identity.toLowerCase();
        authData = await userClient.collection(USERS_COLLECTION).authWithPassword(username, password);
      } catch {
        const email = identity.includes('@') ? identity.toLowerCase() : `${identity.toLowerCase()}@volleyball.local`;
        authData = await userClient.collection(USERS_COLLECTION).authWithPassword(email, password);
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
    const dbConfig = req.app.locals.db;
    let user = {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      claims: req.user.claims
    };

    if (dbConfig.provider === 'pocketbase' && !user.email) {
      const record = await getPbUserById(req.user.uid);
      if (record) {
        user.email = record.email || '';
        user.role = record.role || 'user';
        user.claims = { role: user.role, admin: user.role === 'admin' };
      }
    }

    res.json({ user });
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
    const dbConfig = req.app.locals.db;
    let user = {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    };

    if (dbConfig.provider === 'pocketbase' && !user.email) {
      const record = await getPbUserById(req.user.uid);
      if (record) {
        user.email = record.email || '';
        user.role = record.role || 'user';
      }
    }

    res.json({
      message: 'Используйте токен из заголовка Authorization',
      user
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/update-password
 * Смена пароля пользователя (Firebase — через Firestore)
 */
router.post('/update-password', requireAuth, async (req, res) => {
  try {
    const { uid, password } = req.body;

    if (!uid || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Требуется uid и password'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Пароль должен быть минимум 8 символов'
      });
    }

    const dbConfig = req.app.locals.db;

    if (dbConfig.provider !== 'firebase') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Смена пароля через API доступна только для Firebase'
      });
    }

    const crypto = require('crypto');
    const salt = crypto.randomBytes(16);
    const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const hashedPassword = salt.toString('hex') + ':' + derived.toString('hex');

    const usersCollection = process.env.FIREBASE_USERS_COLLECTION || 'users';
    await dbConfig.db.collection(usersCollection).doc(uid).update({ password: hashedPassword });

    res.json({ message: 'Пароль успешно обновлён' });
  } catch (error) {
    console.error('Update password error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось обновить пароль: ' + error.message
    });
  }
});

module.exports = router;
