/**
 * Custom Error for Scraper Adapters
 * 
 * @param {string} message - The error message.
 * @param {string} adapterName - The name of the adapter where the error occurred.
 * @param {object} [context={}] - Optional context for logging (e.g., url, step).
 */
class AdapterError extends Error {
    constructor(message, adapterName, context = {}) {
        super(message);
        this.name = 'AdapterError';
        this.adapterName = adapterName;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

module.exports = AdapterError;
