require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeDb } = require('./config/db');
const { errorHandler } = require('./middleware/validators');

// Инициализация БД и запуск сервера
initializeDb().then((dbConfig) => {
  const scoreboardRouter = require('./routes/scoreboard');
  const matchesRouter = require('./routes/matches');
  const authRouter = require('./routes/auth');

  // Создание Express приложения
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Сохраняем инстансы в app.locals для доступа в маршрутах
  app.locals.db = dbConfig;
  app.locals.dbProvider = dbConfig.provider;

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || '*',
  }));
  app.use(express.json());

  // Логгирование запросов (dev mode)
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path} [${dbConfig.provider}]`);
      next();
    });
  }

  // Маршруты
  app.use('/api/auth', authRouter);
  app.use('/api/scoreboard', scoreboardRouter);
  app.use('/api/matches', matchesRouter);

  // Swagger UI (только для разработки)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerUi = require('swagger-ui-express');
    const YAML = require('yamljs');
    const swaggerDocument = YAML.load('./swagger.yaml');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs`);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      provider: dbConfig.provider,
      timestamp: new Date().toISOString(),
    });
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
}).catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
