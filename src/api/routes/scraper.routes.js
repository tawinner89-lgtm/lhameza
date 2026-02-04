/**
 * Scraper Routes
 * Scraper management endpoints (protected)
 */

const express = require('express');
const router = express.Router();
const { scraperController } = require('../controllers');
const { asyncHandler, authenticateAPI, scraperLimiter } = require('../middleware');

// GET /api/scraper/status - Get scraper status
router.get('/status', asyncHandler(scraperController.getStatus));

// GET /api/scraper/adapters - Get available adapters
router.get('/adapters', asyncHandler(scraperController.getAdapters));

// POST /api/scraper/run/:adapter - Run specific adapter (protected)
router.post('/run/:adapter', 
    authenticateAPI, 
    scraperLimiter,
    asyncHandler(scraperController.runAdapter)
);

// POST /api/scraper/run - Run multiple adapters (protected)
router.post('/run', 
    authenticateAPI, 
    scraperLimiter,
    asyncHandler(scraperController.runAdapters)
);

module.exports = router;
