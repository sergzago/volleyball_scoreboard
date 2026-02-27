require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeFirebase } = require('./config/firebase');
const { errorHandler } = require('./middleware/validators');
const scoreboardRouter = require('./routes/scoreboard');
const matchesRouter = require('./routes/matches');

// Инициализация Firebase
const { admin } = initializeFirebase();

// Создание Express приложения
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Безопасность HTTP заголовков
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
}));
app.use(express.json());

// Логгирование запросов (dev mode)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Маршруты
app.use('/api/scoreboard', scoreboardRouter);
app.use('/api/matches', matchesRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🏐 Volleyball Scoreboard API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API endpoints:`);
  console.log(`   GET    /api/scoreboard/:game_id`);
  console.log(`   PATCH  /api/scoreboard/:game_id`);
  console.log(`   POST   /api/scoreboard/:game_id/score`);
  console.log(`   POST   /api/scoreboard/:game_id/new-set`);
  console.log(`   POST   /api/scoreboard/:game_id/swap-sides`);
  console.log(`   POST   /api/scoreboard/:game_id/period`);
  console.log(`   POST   /api/scoreboard/:game_id/display`);
  console.log(`   POST   /api/scoreboard/:game_id/label`);
  console.log(`   PUT    /api/scoreboard/:game_id/teams`);
  console.log(`   PATCH  /api/scoreboard/:game_id/settings`);
  console.log(`   POST   /api/scoreboard/:game_id/mode`);
  console.log(`   POST   /api/scoreboard/:game_id/reset`);
  console.log(`   POST   /api/matches`);
  console.log(`   GET    /api/matches`);
});

module.exports = app;
