/**
 * Scraper Controller
 * Handles scraper-related API requests
 */

const { scraperService } = require('../../services');
const { ApiError } = require('../middleware');

/**
 * GET /api/scraper/status
 * Get scraper status
 */
const getStatus = async (req, res) => {
    const status = scraperService.getStatus();
    
    res.json({
        success: true,
        ...status
    });
};

/**
 * GET /api/scraper/adapters
 * Get available adapters
 */
const getAdapters = async (req, res) => {
    const adapters = scraperService.getAvailableAdapters();
    
    res.json({
        success: true,
        count: adapters.length,
        adapters
    });
};

/**
 * POST /api/scraper/run/:adapter
 * Run a specific adapter (protected)
 */
const runAdapter = async (req, res) => {
    const { adapter } = req.params;
    
    if (scraperService.isRunning) {
        throw new ApiError(409, 'A scraper is already running');
    }
    
    // Run in background, return immediately
    res.json({
        success: true,
        message: `Scraper ${adapter} started`,
        status: 'running'
    });
    
    // Actually run the scraper (after response sent)
    scraperService.runAdapter(adapter).catch(err => {
        console.error(`Scraper ${adapter} failed:`, err.message);
    });
};

/**
 * POST /api/scraper/run
 * Run multiple adapters (protected)
 */
const runAdapters = async (req, res) => {
    const { adapters } = req.body;
    
    if (!adapters || !Array.isArray(adapters)) {
        throw new ApiError(400, 'adapters array is required');
    }
    
    if (scraperService.isRunning) {
        throw new ApiError(409, 'A scraper is already running');
    }
    
    res.json({
        success: true,
        message: `Starting ${adapters.length} scrapers`,
        adapters
    });
    
    // Run in background
    scraperService.runAdapters(adapters).catch(err => {
        console.error('Scrapers failed:', err.message);
    });
};

module.exports = {
    getStatus,
    getAdapters,
    runAdapter,
    runAdapters
};
