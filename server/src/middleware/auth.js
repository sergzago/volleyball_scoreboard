/**
 * Middleware для проверки авторизации и ролей пользователей
 * Поддерживает Firebase и PocketBase
 */

/**
 * Middleware для проверки аутентификации пользователя
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Требуется авторизация. Пожалуйста, войдите в систему.'
    });
  }

  const token = authHeader.split('Bearer ')[1];
  const dbConfig = req.app.locals.db;

  try {
    if (dbConfig.provider === 'firebase') {
      const { admin } = dbConfig;
      const decodedToken = await admin.auth().verifyIdToken(token);

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || 'user',
        claims: decodedToken.claims || {}
      };
    } else if (dbConfig.provider === 'pocketbase') {
      // PocketBase: проверяем токен через SDK
      const { client } = dbConfig;
      const usersCollection = process.env.POCKETBASE_USERS_COLLECTION || 'scoreusers';
      const record = await client.collection(usersCollection).getFirstListItem(`token = "${token}"`)
        .catch(() => null);

      if (!record) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Неверный или истекший токен авторизации.'
        });
      }

      req.user = {
        uid: record.id,
        email: record.email,
        role: record.role || 'user',
        claims: { role: record.role || 'user', admin: record.role === 'admin' }
      };
    } else {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unknown database provider'
      });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Неверный или истекший токен авторизации.'
    });
  }
}

/**
 * Middleware для проверки роли администратора
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Требуется авторизация.'
    });
  }

  const isAdmin = req.user.claims?.admin === true || req.user.role === 'admin';

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Доступ запрещен. Требуются права администратора.'
    });
  }

  next();
}

/**
 * Middleware для проверки роли (гибкая проверка)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Требуется авторизация.'
      });
    }

    const userRole = req.user.claims?.role || req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Доступ запрещен. Требуются права: ${allowedRoles.join(' или ')}.`
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireRole
};
