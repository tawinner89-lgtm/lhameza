const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ScraperManager = require('../src/adapters/ScraperManager');
const { ADAPTERS } = require('../src/adapters');
const { CATEGORIES } = require('../config/categories');

// --- Helper Functions ---

/**
 * Gets a list of all available adapter keys.
 * e.g., ['JumiaAdapter', 'NikeAdapter', ...]
 */
const getAllAdapterKeys = () => {
    return Object.keys(ADAPTERS);
};

/**
 * Gets adapter keys for a specific category from config/categories.js
 * @param {string} category The category name to look up.
 * @returns {string[]} A list of adapter keys.
 */
const getAdaptersByCategory = (category) => {
    const uppercaseCategory = category.toUpperCase();
    if (!CATEGORIES[uppercaseCategory]) {
        console.error(`Error: Category "${category}" not found. Please check config/categories.js.`);
        console.log('Available categories:', Object.keys(CATEGORIES).map(c => c.toLowerCase()).join(', '));
        process.exit(1);
    }
    return CATEGORIES[uppercaseCategory];
};

/**
 * The main function to run the scrapers.
 * @param {string[]} adaptersToRun - A list of adapter keys to initialize and run.
 */
const runScraper = async (adaptersToRun) => {
    if (!adaptersToRun || adaptersToRun.length === 0) {
        console.error('Error: No adapters selected to run. Please specify an adapter, a category, or use the --all flag.');
        process.exit(1);
    }
    
    console.log('Initializing Scraper Manager for the following adapters:');
    console.log(adaptersToRun.join(', '));
    console.log('---');

    const scraperManager = new ScraperManager(adaptersToRun);

    try {
        await scraperManager.start();
        console.log('---');
        console.log('Scraping process completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('---');
        console.error('An unexpected error occurred during the scraping process:');
        console.error(error);
        process.exit(1);
    }
};

// --- Main Execution ---

// Use yargs to parse command line arguments
const argv = yargs(hideBin(process.argv))
    .usage('Usage: node $0 [options]')
    .option('adapter', {
        alias: 'a',
        describe: 'Run a single adapter by its name (e.g., JumiaAdapter)',
        type: 'string',
    })
    .option('category', {
        alias: 'c',
        describe: 'Run all adapters in a specific category (e.g., fashion)',
        type: 'string',
    })
    .option('all', {
        describe: 'Run all available adapters',
        type: 'boolean',
    })
    .check((argv) => {
        const count = (argv.adapter ? 1 : 0) + (argv.category ? 1 : 0) + (argv.all ? 1 : 0);
        if (count > 1) {
            throw new Error('Error: Please specify only one of --adapter, --category, or --all.');
        }
        if (count === 0) {
            throw new Error('Error: You must specify an option. Use --help for more information.');
        }
        return true;
    })
    .help('h')
    .alias('h', 'help')
    .argv;

// Decide which adapters to run based on the arguments
let adapters;

if (argv.all) {
    console.log('Selected: Run all adapters.');
    adapters = getAllAdapterKeys();
} else if (argv.category) {
    console.log(`Selected: Run adapters in category "${argv.category}".`);
    adapters = getAdaptersByCategory(argv.category);
} else if (argv.adapter) {
    console.log(`Selected: Run single adapter "${argv.adapter}".`);
    // Ensure the requested adapter exists
    if (!ADAPTERS[argv.adapter]) {
        console.error(`Error: Adapter "${argv.adapter}" not found.`);
        console.log('Available adapters:', getAllAdapterKeys().join(', '));
        process.exit(1);
    }
    adapters = [argv.adapter];
}

// Run the scraper with the selected adapters
runScraper(adapters);
