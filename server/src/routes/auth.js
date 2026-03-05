/**
 * Маршруты для аутентификации и управления пользователями
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/auth/me
 * Получить информацию о текущем пользователе
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      user: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.claims?.admin ? 'admin' : 'user',
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
 * POST /api/auth/set-role
 * Установить роль пользователя (только админ)
 */
router.post('/set-role', requireAdmin, async (req, res) => {
  try {
    const { uid, role } = req.body;

    if (!uid || !role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Требуется uid и role'
      });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Роль должна быть "admin" или "user"'
      });
    }

    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();

    // Устанавливаем custom claims
    await admin.auth().setCustomUserClaims(uid, { 
      role: role,
      admin: role === 'admin'
    });

    res.json({
      success: true,
      message: `Роль пользователя ${role} установлена успешно`
    });
  } catch (error) {
    console.error('Set role error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/users
 * Получить список всех пользователей (только админ)
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();
    
    // Получаем список пользователей из Firebase Auth
    const listUsersResult = await admin.auth().listUsers();
    
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: userRecord.customClaims?.admin ? 'admin' : 'user',
      createdAt: userRecord.metadata.creationTime,
      lastLoginAt: userRecord.metadata.lastSignInTime
    }));

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/users
 * Создать нового пользователя (только админ)
 */
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, displayName, role = 'user' } = req.body;

    // Проверяем, что предоставлен username или email
    if (!username && !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Требуется username или email'
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Требуется пароль'
      });
    }

    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();
    const db = admin.firestore();

    // Если предоставлен только username, генерируем email
    const finalEmail = email || `${username.toLowerCase()}@volleyball.local`;
    const finalUsername = username || email.split('@')[0];
    const finalDisplayName = displayName || finalUsername;

    // Создаем пользователя в Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: finalEmail,
      password,
      displayName: finalDisplayName
    });

    // Устанавливаем роль через custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role,
      admin: role === 'admin'
    });

    // Сохраняем пользователя в Firestore
    await db.collection('users').doc(finalUsername.toLowerCase()).set({
      uid: userRecord.uid,
      email: finalEmail,
      username: finalUsername.toLowerCase(),
      displayName: finalDisplayName,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null
    });

    res.status(201).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: finalEmail,
        username: finalUsername,
        displayName: finalDisplayName,
        role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * PUT /api/auth/users/:uid
 * Обновить пользователя (только админ)
 */
router.put('/users/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { email, password, displayName, role } = req.body;

    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();

    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (displayName !== undefined) updateData.displayName = displayName;

    // Обновляем данные пользователя
    if (Object.keys(updateData).length > 0) {
      await admin.auth().updateUser(uid, updateData);
    }

    // Обновляем роль если указано
    if (role) {
      await admin.auth().setCustomUserClaims(uid, {
        role,
        admin: role === 'admin'
      });
    }

    const updatedUser = await admin.auth().getUser(uid);
    
    res.json({
      success: true,
      user: {
        uid: updatedUser.uid,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: updatedUser.customClaims?.admin ? 'admin' : 'user'
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/auth/users/:uid
 * Удалить пользователя (только админ)
 */
router.delete('/users/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;

    // Проверка: нельзя удалить самого себя
    if (uid === req.user.uid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Нельзя удалить самого себя'
      });
    }

    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();

    await admin.auth().deleteUser(uid);

    res.json({
      success: true,
      message: 'Пользователь успешно удален'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/token
 * Получить новый токен (для обновления)
 */
router.post('/token', requireAuth, async (req, res) => {
  try {
    // Возвращаем текущую информацию о пользователе
    // Клиент должен запросить новый токен через Firebase SDK
    res.json({
      message: 'Получите новый токен через Firebase SDK на клиенте',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.claims?.admin ? 'admin' : 'user'
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
