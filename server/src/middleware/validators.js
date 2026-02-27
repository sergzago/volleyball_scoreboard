/**
 * Middleware для обработки ошибок
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.code === 'FIREBASE_NOT_CONFIGURED' || err.message?.includes('Firestore not initialized')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Firestore not configured. Set Firebase credentials in .env',
    });
  }

  if (err.message === 'Scoreboard not found') {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message,
    });
  }

  if (err.message === 'Score cannot be negative') {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  if (err.message.startsWith('Period must be between') || 
      err.message.startsWith('Invalid show value')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
}

/**
 * Middleware для валидации game_id
 */
function validateGameId(req, res, next) {
  const { game_id } = req.params;
  
  if (!game_id || game_id.trim() === '') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'game_id is required',
    });
  }

  next();
}

/**
 * Middleware для валидации команды (home/away)
 */
function validateTeam(req, res, next) {
  const { team } = req.body;
  
  if (!team || (team !== 'home' && team !== 'away')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'team must be "home" or "away"',
    });
  }

  next();
}

/**
 * Middleware для валидации delta (±1)
 */
function validateDelta(req, res, next) {
  const { delta } = req.body;
  
  if (delta !== 1 && delta !== -1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'delta must be 1 or -1',
    });
  }

  next();
}

/**
 * Middleware для валидации периода
 */
function validatePeriodDelta(req, res, next) {
  const { delta } = req.body;
  
  if (delta !== 1 && delta !== -1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'delta must be 1 or -1',
    });
  }

  next();
}

/**
 * Middleware для валидации режима
 */
function validateMode(req, res, next) {
  const { beach_mode } = req.body;
  
  if (typeof beach_mode !== 'boolean') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'beach_mode must be a boolean',
    });
  }

  next();
}

module.exports = {
  errorHandler,
  validateGameId,
  validateTeam,
  validateDelta,
  validatePeriodDelta,
  validateMode,
};
