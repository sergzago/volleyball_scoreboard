const express = require('express');
const { ScoreboardService } = require('../services/scoreboardService');

const router = express.Router();
const scoreboardService = new ScoreboardService();

/**
 * @route   POST /api/matches
 * @desc    Сохранить результат матча
 */
router.post('/', async (req, res, next) => {
  try {
    const { game_id, setHistory, overallHome, overallAway } = req.body;
    
    if (!game_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'game_id is required',
      });
    }
    
    const result = await scoreboardService.saveMatchResult(game_id, {
      setHistory,
      overallHome,
      overallAway,
    });
    
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/matches
 * @desc    Получить список матчей (опционально с фильтрами)
 */
router.get('/', async (req, res, next) => {
  try {
    const { tournament, game_type, limit = 50 } = req.query;
    
    let query = require('../config/firebase').db.collection('matches');
    
    if (tournament) {
      query = query.where('tournament_name', '==', tournament);
    }
    
    if (game_type) {
      query = query.where('game_type', '==', game_type);
    }
    
    query = query.orderBy('date_time', 'desc').limit(parseInt(limit));
    
    const snapshot = await query.get();
    const matches = [];
    
    snapshot.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/matches/:id
 * @desc    Получить详细信息 матча по ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const doc = await require('../config/firebase').db.collection('matches').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Match not found',
      });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
