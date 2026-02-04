/**
 * Deals Routes
 * All deal-related API endpoints
 */

const express = require('express');
const router = express.Router();
const { dealsController } = require('../controllers');
const { asyncHandler } = require('../middleware');

// GET /api/deals - Get all deals
router.get('/', asyncHandler(dealsController.getAllDeals));

// GET /api/deals/hamza - Get L'HAMZA deals
router.get('/hamza', asyncHandler(dealsController.getHamzaDeals));

// GET /api/deals/super-hamza - Get Super L'HAMZA deals
router.get('/super-hamza', asyncHandler(dealsController.getSuperHamzaDeals));

// GET /api/deals/id/:id - Get deal by ID
router.get('/id/:id', asyncHandler(dealsController.getDealById));

// GET /api/deals/:category - Get deals by category
router.get('/:category', asyncHandler(dealsController.getDealsByCategory));

module.exports = router;
