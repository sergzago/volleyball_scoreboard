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
const scoreboardService = new ScoreboardService();

/**
 * @route   GET /api/scoreboard/:game_id
 * @desc    Получить состояние табло
 */
router.get('/:game_id', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const data = await scoreboardService.getScoreboard(game_id);
    
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
    
    const result = await scoreboardService.updateScoreboard(game_id, updateData);
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
    
    const result = await scoreboardService.updateScore(game_id, team, delta);
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
    
    const result = await scoreboardService.newSet(game_id);
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
    
    const result = await scoreboardService.swapSides(game_id);
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
    
    const result = await scoreboardService.updatePeriod(game_id, delta);
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
    
    const result = await scoreboardService.updateDisplay(game_id, show);
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
    
    const result = await scoreboardService.updateLabel(game_id, custom_label);
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
    
    const result = await scoreboardService.updateTeams(game_id, teamsData);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/scoreboard/:game_id/settings
 * @desc    Обновить настройки (invert_tablo, unlimited_score)
 */
router.patch('/:game_id/settings', validateGameId, async (req, res, next) => {
  try {
    const { game_id } = req.params;
    const settings = req.body;
    
    const result = await scoreboardService.updateSettings(game_id, settings);
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
    
    const result = await scoreboardService.toggleMode(game_id, beach_mode);
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
    
    const result = await scoreboardService.reset(game_id, keep_settings);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
