# L'HAMZA F SEL'A

> Google of Deals in Morocco 🇲🇦

Smart deal finder that scrapes trending products from popular Moroccan & international stores.

## Quick Start

```bash
# Install dependencies
npm install

# Start API server
npm start

# Run smart scraper (trending + best sellers)
npm run smart
```

## Project Structure

```
src/
├── adapters/           # Store scrapers
│   ├── BaseAdapter.js  # Base class with circuit breaker, retry, metrics
│   ├── JumiaAdapter.js
│   ├── ZaraAdapter.js
│   ├── NikeAdapter.js
│   └── ...
├── api/
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, rate limiting, error handling
│   ├── routes/         # Route definitions
│   └── server.js       # Express server
├── services/
│   ├── database.service.js
│   ├── scraper.service.js
│   └── queue.service.js
├── utils/
│   ├── constants.js    # Enums and defaults
│   ├── errors.js       # Custom error classes
│   ├── helpers.js      # Utility functions
│   ├── logger.js       # Winston logger
│   └── validators.js   # Data validation
├── database-v2.js      # JSON file database
└── index.js            # Main export

scripts/
├── run-morocco.js      # Scrape by category/adapter
├── run-fashion-brands.js
├── run-smart-scraper.js  # Smart scraping (trending)
└── run-all.js

config/
├── categories.js
├── popular-products.js  # Trending searches, popular brands
└── index.js

frontend/               # Next.js frontend
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start API server |
| `npm run dev` | Start with auto-reload |
| `npm run smart` | Smart scrape (trending products) |
| `npm run scrape` | Scrape all Morocco stores |
| `npm run scrape:tech` | Scrape tech category |
| `npm run scrape:fashion` | Scrape fashion category |
| `npm run scrape:jumia` | Scrape Jumia only |
| `npm run scrape:zara` | Scrape Zara only |
| `npm run scrape:nike` | Scrape Nike only |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/stats` | Database statistics |
| `GET /api/deals` | All deals |
| `GET /api/deals/:category` | Deals by category |
| `GET /api/search?q=iphone` | Search deals |
| `GET /api/hamza` | Best deals (score >= 7) |
| `GET /api/super-hamza` | Amazing deals (score > 8) |

## Supported Stores

### Morocco
- Jumia (🛍️ Tech, Fashion, Home, Beauty)
- Marjane (🛒)
- Electroplanet (💻)
- Decathlon (⚽)
- LC Waikiki (👕)
- Kitea (🛋️)
- BIM (🏪)

### Fashion Brands
- Zara (👗)
- Nike (👟)
- Adidas (👟)
- Pull&Bear (🧥)
- Bershka (👚)

## Smart Scraping

The smart scraper focuses on what people actually want:

- **Trending products**: iPhone, Samsung, Nike, etc.
- **Big discounts**: 40%+ off
- **Popular brands**: Apple, Samsung, Nike, Adidas
- **High-rated products**: 4+ stars
- **Best sellers**

```bash
npm run smart
```

## Tech Stack

- **Backend**: Node.js, Express
- **Scraping**: Playwright
- **Frontend**: Next.js, Tailwind CSS
- **Database**: JSON files (local)
- **Logging**: Winston

## Configuration

Create `.env` file:

```env
PORT=3000
NODE_ENV=development
API_KEY=your-secret-key
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

## License

MIT
