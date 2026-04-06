const express = require('express');
const { ScoreboardService } = require('../services/scoreboardService');
const { createDbAdapter, MATCHES_COLLECTION } = require('../services/dbAdapter');

const router = express.Router();

function getService(req) {
  return new ScoreboardService(req.app.locals.db);
}

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

    const result = await getService(req).saveMatchResult(game_id, {
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
    const dbAdapter = createDbAdapter(req.app.locals.db);

    const filters = {
      orderBy: { field: 'date_time', direction: 'desc' },
      limit: parseInt(limit),
    };

    const where = [];
    if (tournament) where.push(['tournament_name', '==', tournament]);
    if (game_type) where.push(['game_type', '==', game_type]);
    if (where.length > 0) filters.where = where;

    const matches = await dbAdapter.queryDocs(MATCHES_COLLECTION, filters);
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/matches/:id
 * @desc    Получить details матча по ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbAdapter = createDbAdapter(req.app.locals.db);
    const match = await dbAdapter.getDoc(MATCHES_COLLECTION, id);

    if (!match) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Match not found',
      });
    }

    res.json(match);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
