/**
 * L'HAMZA F SEL'A - Main Export
 * Google of Deals in Morocco
 */

// Adapters
const adapters = require('./adapters');

// Services
const services = require('./services');

// Utilities
const utils = require('./utils');

// Database
const database = require('./database-v2');

// Logger
const logger = require('./utils/logger');

module.exports = {
    // Adapters
    ...adapters,
    
    // Services
    ...services,
    
    // Utilities
    ...utils,
    
    // Core
    database,
    logger
};
