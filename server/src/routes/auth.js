/**
 * Маршруты для аутентификации и управления пользователями
 * Поддерживает Firebase и PocketBase
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createDbAdapter } = require('../services/dbAdapter');

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

    const dbConfig = req.app.locals.db;

    if (dbConfig.provider === 'firebase') {
      await dbConfig.admin.auth().setCustomUserClaims(uid, {
        role,
        admin: role === 'admin'
      });
    } else if (dbConfig.provider === 'pocketbase') {
      const dbAdapter = createDbAdapter(dbConfig);
      await dbAdapter.client.collection('_users').update(uid, { role });
    }

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
    const dbConfig = req.app.locals.db;
    let users = [];

    if (dbConfig.provider === 'firebase') {
      const listUsersResult = await dbConfig.admin.auth().listUsers();
      users = listUsersResult.users.map(userRecord => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: userRecord.customClaims?.admin ? 'admin' : 'user',
        createdAt: userRecord.metadata.creationTime,
        lastLoginAt: userRecord.metadata.lastSignInTime
      }));
    } else if (dbConfig.provider === 'pocketbase') {
      const dbAdapter = createDbAdapter(dbConfig);
      const records = await dbAdapter.client.collection('_users').getFullList();
      users = records.map(r => ({
        uid: r.id,
        email: r.email,
        displayName: r.displayName,
        username: r.username,
        role: r.role || 'user',
        createdAt: r.created,
        lastLoginAt: r.lastLoginAt
      }));
    }

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

    const dbConfig = req.app.locals.db;
    const finalEmail = email || `${username.toLowerCase()}@volleyball.local`;
    const finalUsername = username || email.split('@')[0];
    const finalDisplayName = displayName || finalUsername;

    if (dbConfig.provider === 'firebase') {
      const userRecord = await dbConfig.admin.auth().createUser({
        email: finalEmail,
        password,
        displayName: finalDisplayName
      });

      await dbConfig.admin.auth().setCustomUserClaims(userRecord.uid, {
        role,
        admin: role === 'admin'
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
    } else if (dbConfig.provider === 'pocketbase') {
      const dbAdapter = createDbAdapter(dbConfig);
      const record = await dbAdapter.client.collection('_users').create({
        username: finalUsername.toLowerCase(),
        email: finalEmail,
        password,
        passwordConfirm: password,
        displayName: finalDisplayName,
        role,
        emailVisibility: true
      });

      res.status(201).json({
        success: true,
        user: {
          uid: record.id,
          email: record.email,
          username: record.username,
          displayName: record.displayName,
          role
        }
      });
    }
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

    const dbConfig = req.app.locals.db;

    if (dbConfig.provider === 'firebase') {
      const updateData = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (displayName !== undefined) updateData.displayName = displayName;

      if (Object.keys(updateData).length > 0) {
        await dbConfig.admin.auth().updateUser(uid, updateData);
      }
      if (role) {
        await dbConfig.admin.auth().setCustomUserClaims(uid, {
          role,
          admin: role === 'admin'
        });
      }

      const updatedUser = await dbConfig.admin.auth().getUser(uid);
      res.json({
        success: true,
        user: {
          uid: updatedUser.uid,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          role: updatedUser.customClaims?.admin ? 'admin' : 'user'
        }
      });
    } else if (dbConfig.provider === 'pocketbase') {
      const dbAdapter = createDbAdapter(dbConfig);
      const updateData = {};
      if (email) updateData.email = email;
      if (password) {
        updateData.password = password;
        updateData.passwordConfirm = password;
      }
      if (displayName !== undefined) updateData.displayName = displayName;
      if (role) updateData.role = role;

      const record = await dbAdapter.client.collection('_users').update(uid, updateData);
      res.json({
        success: true,
        user: {
          uid: record.id,
          email: record.email,
          displayName: record.displayName,
          role: record.role || 'user'
        }
      });
    }
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

    if (uid === req.user.uid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Нельзя удалить самого себя'
      });
    }

    const dbConfig = req.app.locals.db;

    if (dbConfig.provider === 'firebase') {
      await dbConfig.admin.auth().deleteUser(uid);
    } else if (dbConfig.provider === 'pocketbase') {
      const dbAdapter = createDbAdapter(dbConfig);
      await dbAdapter.client.collection('_users').delete(uid);
    }

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
