const express = require('express');
const { ScoreboardService } = require('../services/scoreboardService');
const {
  validateGameId,
  validateTeam,
  validateDelta,
  validatePeriodDelta,
  validateMode,
} = require('../middleware/validators');

const router = express.Router();

// Factory для создания сервиса с текущим dbConfig
function getService(req) {
  return new ScoreboardService(req.app.locals.db);
}

/**
 * @route   POST /api/scoreboard
 * @desc    Создать новую игру
 */
router.post('/', async (req, res, next) => {
  try {
    const { game_id, ...data } = req.body;

    if (!game_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'game_id is required',
      });
    }

    const result = await getService(req).createScoreboard(game_id, data);
    res.status(201).json(result);
  } catch (err) {
    if (err.message && err.message.startsWith('Scoreboard with id')) {
      return res.status(409).json({
        error: 'Conflict',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * @route   GET /api/scoreboard/:game_id
 * @desc    Получить состояние табло
 */
router.get('/:game_id', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const data = await getService(req).getScoreboard(game_id);
    
    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Scoreboard not found',
      });
    }
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/scoreboard/:game_id
 * @desc    Обновить произвольные поля табло
 */
router.patch('/:game_id', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const data = req.body;
    
    // Удаляем служебные поля из запроса
    const { lastEdited, ...updateData } = data;
    
    const result = await getService(req).updateScoreboard(game_id, updateData);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/score
 * @desc    Изменить счёт (добавить/убрать очко)
 */
router.post('/:game_id/score', validateGameId, validateTeam, validateDelta, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { team, delta } = req.body;
    
    const result = await getService(req).updateScore(game_id, team, delta);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/new-set
 * @desc    Начать новый сет
 */
router.post('/:game_id/new-set', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    
    const result = await getService(req).newSet(game_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/swap-sides
 * @desc    Смена сторон площадок
 */
router.post('/:game_id/swap-sides', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    
    const result = await getService(req).swapSides(game_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/period
 * @desc    Изменить период/сет
 */
router.post('/:game_id/period', validateGameId, validatePeriodDelta, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { delta } = req.body;
    
    const result = await getService(req).updatePeriod(game_id, delta);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/display
 * @desc    Настроить отображение
 */
router.post('/:game_id/display', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { show } = req.body;
    
    const result = await getService(req).updateDisplay(game_id, show);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/label
 * @desc    Обновить кастомную метку
 */
router.post('/:game_id/label', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { custom_label } = req.body;
    
    const result = await getService(req).updateLabel(game_id, custom_label);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/scoreboard/:game_id/teams
 * @desc    Обновить информацию о командах
 */
router.put('/:game_id/teams', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const teamsData = req.body;
    
    const result = await getService(req).updateTeams(game_id, teamsData);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/scoreboard/:game_id/settings
 * @desc    Обновить настройки (invert_tablo, unlimited_score, two_wins_mode)
 */
router.patch('/:game_id/settings', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const settings = req.body;

    const result = await getService(req).updateSettings(game_id, settings);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/mode
 * @desc    Переключить режим (пляжный/классический)
 */
router.post('/:game_id/mode', validateGameId, validateMode, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { beach_mode } = req.body;
    
    const result = await getService(req).toggleMode(game_id, beach_mode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/scoreboard/:game_id/reset
 * @desc    Сбросить табло
 */
router.post('/:game_id/reset', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const { keep_settings = true } = req.body;
    
    const result = await getService(req).reset(game_id, keep_settings);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
