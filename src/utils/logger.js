/**
 * Logger Utility
 * Centralized logging with Winston
 */

const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} ${level}: ${message} ${metaStr}`;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'lhamza-f-sela' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: path.join(process.cwd(), 'logs', 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
