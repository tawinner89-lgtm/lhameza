/**
 * Configuration Index
 * Central configuration management
 */

require('dotenv').config();

const config = {
    // Server
    port: parseInt(process.env.API_PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // API
    apiKey: process.env.API_KEY || null,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    
    // Rate Limiting
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: process.env.NODE_ENV === 'production' ? 100 : 500
    },
    
    // Scraper
    scraper: {
        timeout: parseInt(process.env.SCRAPER_TIMEOUT) || 60000,
        retries: parseInt(process.env.SCRAPER_RETRIES) || 3,
        concurrent: parseInt(process.env.SCRAPER_CONCURRENT) || 2,
        headless: process.env.SCRAPER_HEADLESS !== 'false'
    },
    
    // Telegram (optional)
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        enabled: !!process.env.TELEGRAM_BOT_TOKEN
    },
    
    // Database
    database: {
        dataDir: process.env.DATA_DIR || 'data',
        imagesDir: process.env.IMAGES_DIR || 'data/images'
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || 'logs'
    }
};

// Import category and source configs
const { CATEGORIES, SOURCES, URL_CATEGORY_MAP } = require('./categories');

module.exports = {
    ...config,
    CATEGORIES,
    SOURCES,
    URL_CATEGORY_MAP
};
