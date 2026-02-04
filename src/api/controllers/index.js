/**
 * Controllers Index
 * Central export for all controllers
 */

const dealsController = require('./deals.controller');
const statsController = require('./stats.controller');
const scraperController = require('./scraper.controller');

module.exports = {
    dealsController,
    statsController,
    scraperController
};
