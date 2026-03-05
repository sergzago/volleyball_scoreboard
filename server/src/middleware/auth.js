/**
 * Middleware для проверки авторизации и ролей пользователей
 */

/**
 * Middleware для проверки аутентификации пользователя
 * Проверяет Firebase ID токен в заголовке Authorization
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Требуется авторизация. Пожалуйста, войдите в систему.'
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const { admin } = req.app.locals.firebase || require('../config/firebase').initializeFirebase();
    
    // Проверка токена через Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Добавляем информацию о пользователе в запрос
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user', // Роль из custom claims
      claims: decodedToken.claims || {}
    };

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
 * Должен использоваться после requireAuth
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Требуется авторизация.'
    });
  }

  // Проверяем роль через custom claims
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
 * @param {string[]} allowedRoles - Массив разрешенных ролей
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
