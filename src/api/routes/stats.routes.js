/**
 * Stats Routes
 * Statistics and metadata endpoints
 */

const express = require('express');
const router = express.Router();
const { statsController } = require('../controllers');
const { asyncHandler } = require('../middleware');

// GET /api/stats - Get statistics
router.get('/', asyncHandler(statsController.getStats));

// GET /api/categories - Get categories
router.get('/categories', asyncHandler(statsController.getCategories));

// GET /api/sources - Get sources
router.get('/sources', asyncHandler(statsController.getSources));

// GET /api/brands - Get brands
router.get('/brands', asyncHandler(statsController.getBrands));

// GET /api/cities - Get cities
router.get('/cities', asyncHandler(statsController.getCities));

module.exports = router;
