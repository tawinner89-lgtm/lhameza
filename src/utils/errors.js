/**
 * Custom Error Classes
 * Structured error handling for the application
 */

/**
 * Base application error
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'APP_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp
        };
    }
}

/**
 * Scraper-specific error
 */
class ScraperError extends AppError {
    constructor(message, adapter = null, details = {}) {
        super(message, 500, 'SCRAPER_ERROR');
        this.adapter = adapter;
        this.details = details;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            adapter: this.adapter,
            details: this.details
        };
    }
}

/**
 * Network/HTTP error
 */
class NetworkError extends ScraperError {
    constructor(message, url = null, statusCode = null) {
        super(message, null, { url, httpStatus: statusCode });
        this.code = 'NETWORK_ERROR';
        this.url = url;
        this.httpStatus = statusCode;
    }
}

/**
 * Timeout error
 */
class TimeoutError extends ScraperError {
    constructor(message, timeout = null, url = null) {
        super(message, null, { timeout, url });
        this.code = 'TIMEOUT_ERROR';
        this.timeout = timeout;
    }
}

/**
 * Parsing/extraction error
 */
class ParsingError extends ScraperError {
    constructor(message, selector = null, html = null) {
        super(message, null, { selector });
        this.code = 'PARSING_ERROR';
        this.selector = selector;
        // Don't store full HTML, just a snippet
        this.htmlSnippet = html ? html.substring(0, 200) : null;
    }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
    constructor(message, field = null, value = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
        this.value = value;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field
        };
    }
}

/**
 * Rate limit error
 */
class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded', retryAfter = null) {
        super(message, 429, 'RATE_LIMIT_ERROR');
        this.retryAfter = retryAfter;
    }
}

/**
 * Database error
 */
class DatabaseError extends AppError {
    constructor(message, operation = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.operation = operation;
    }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found', resource = null) {
        super(message, 404, 'NOT_FOUND');
        this.resource = resource;
    }
}

/**
 * Circuit breaker open error
 */
class CircuitOpenError extends ScraperError {
    constructor(adapter, nextRetry = null) {
        super(`Circuit breaker is open for ${adapter}`, adapter);
        this.code = 'CIRCUIT_OPEN';
        this.nextRetry = nextRetry;
    }
}

module.exports = {
    AppError,
    ScraperError,
    NetworkError,
    TimeoutError,
    ParsingError,
    ValidationError,
    RateLimitError,
    DatabaseError,
    NotFoundError,
    CircuitOpenError
};
