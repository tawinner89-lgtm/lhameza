/**
 * L'HAMZA F SEL'A - REST API Server v3
 * 
 * Modular Architecture:
 * - Controllers: Handle request/response
 * - Services: Business logic
 * - Middleware: Cross-cutting concerns
 * - Routes: URL mapping
 * 
 * Core Endpoints:
 * - GET /api/deals              - All deals (with filters)
 * - GET /api/deals/:category    - Deals by category
 * - GET /api/deals/super-hamza  - Super L'HAMZA deals (score > 8)
 * - GET /api/deals/hamza        - L'HAMZA deals (score >= 7)
 * - GET /api/search             - Search deals
 * - GET /api/stats              - Database statistics
 * - GET /api/categories         - Available categories
 * - GET /api/health             - Health check
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import modules
const routes = require('./routes');
const { apiLimiter, errorHandler, notFoundHandler } = require('./middleware');
const { databaseService } = require('../services');
const logger = require('../utils/logger');

const app = express();
const PORT = process.env.API_PORT || 3000;

// ===========================================
// MIDDLEWARE SETUP
// ===========================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
            duration: `${duration}ms`,
            query: Object.keys(req.query).length ? req.query : undefined
        });
    });
    
    next();
});

// ===========================================
// ROUTES
// ===========================================

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: "L'HAMZA F SEL'A API",
        version: '3.0.0',
        description: 'Google of Deals in Morocco 🇲🇦',
        endpoints: {
            deals: '/api/deals',
            categories: '/api/categories',
            search: '/api/search?q=query',
            stats: '/api/stats',
            health: '/api/health'
        },
        documentation: 'https://github.com/lhamza-f-sela/api-docs'
    });
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===========================================
// SERVER STARTUP
// ===========================================

async function startServer() {
    try {
        // Initialize database
        await databaseService.initialize();
        logger.info('Database initialized for API');

        // Start server
        app.listen(PORT, () => {
            console.log('\n');
            console.log('╔════════════════════════════════════════════════════════════════════╗');
            console.log("║   🔥 L'HAMZA F SEL'A - API Server v3                               ║");
            console.log('║   Google of Deals in Morocco 🇲🇦                                    ║');
            console.log('╚════════════════════════════════════════════════════════════════════╝');
            console.log('\n');
            console.log(`   🚀 Server running at http://localhost:${PORT}`);
            console.log(`   📊 Stats: http://localhost:${PORT}/api/stats`);
            console.log(`   🔍 Search: http://localhost:${PORT}/api/search?q=iphone`);
            console.log(`   💰 Deals: http://localhost:${PORT}/api/deals`);
            console.log(`   ❤️ Health: http://localhost:${PORT}/api/health`);
            console.log('\n');
            
            const stats = databaseService.getStats();
            console.log(`   📦 Loaded ${stats.totalDeals} deals`);
            console.log(`   🏷️ Categories: ${Object.keys(stats.byCategory || {}).join(', ')}`);
            console.log('\n');
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
