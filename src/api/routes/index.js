/**
 * Routes Index
 * Central router configuration
 */

const express = require('express');
const router = express.Router();

const dealsRoutes = require('./deals.routes');
const statsRoutes = require('./stats.routes');
const scraperRoutes = require('./scraper.routes');
const { statsController } = require('../controllers');
const { dealsController } = require('../controllers');
const { asyncHandler } = require('../middleware');

// Health check
router.get('/health', asyncHandler(statsController.healthCheck));

// Mount route modules
router.use('/deals', dealsRoutes);
router.use('/stats', statsRoutes);
router.use('/scraper', scraperRoutes);

// Additional top-level routes
router.get('/categories', asyncHandler(statsController.getCategories));
router.get('/sources', asyncHandler(statsController.getSources));
router.get('/brands', asyncHandler(statsController.getBrands));
router.get('/cities', asyncHandler(statsController.getCities));
router.get('/search', asyncHandler(dealsController.searchDeals));

module.exports = router;
