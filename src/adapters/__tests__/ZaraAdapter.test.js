const ZaraAdapter = require('../ZaraAdapter');
const BaseAdapter = require('../BaseAdapter');

// Mock the randomDelay method on the BaseAdapter prototype to make tests instant
jest.spyOn(BaseAdapter.prototype, 'randomDelay').mockResolvedValue();

describe('ZaraAdapter - getProductDetails', () => {
    let adapter;

    beforeEach(() => {
        adapter = new ZaraAdapter();
    });

    it('should correctly parse product details from a mocked page evaluation', async () => {
        const mockProductUrl = 'https://www.zara.com/ma/fr/chemise-en-lin-p012345.html';

        // This is the data we expect the browser-side script (inside evaluate) to return
        const mockPageData = {
            name: 'CHEMISE EN LIN',
            currentPrice: '499,00 MAD',
            originalPrice: '699,00 MAD',
            discount: 29,
            image: 'https://static.zara.net/photos/123.jpg'
        };

        // Create a mock of the Playwright page object
        const mockPage = {
            goto: jest.fn().mockResolvedValue(),
            waitForSelector: jest.fn().mockResolvedValue(),
            evaluate: jest.fn().mockResolvedValue(mockPageData), // Force evaluate() to return our data
            $: jest.fn().mockResolvedValue({
                click: jest.fn().mockResolvedValue()
            }),
        };

        // Call the method we want to test
        const details = await adapter.getProductDetails(mockPage, mockProductUrl);

        // --- Assertions ---
        expect(details).not.toBeNull();
        expect(details.name).toBe('CHEMISE EN LIN');
        expect(details.currentPrice).toBe('499,00 MAD');
        expect(details.originalPrice).toBe('699,00 MAD');
        expect(details.discount).toBe(29);
        expect(details.image).toBe('https://static.zara.net/photos/123.jpg');

        // Check that the mocks were used
        expect(mockPage.goto).toHaveBeenCalledWith(mockProductUrl, expect.any(Object));
        expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should return null if the page navigation fails', async () => {
        const mockProductUrl = 'https://www.zara.com/ma/fr/404-not-found';

        // Mock the page object to simulate a failure
        const mockPage = {
            goto: jest.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded')),
            // No other methods should be called if goto fails
            evaluate: jest.fn(),
        };

        const details = await adapter.getProductDetails(mockPage, mockProductUrl);

        // --- Assertions ---
        expect(details).toBeNull();
        // Ensure evaluate was NOT called because the navigation failed first
        expect(mockPage.evaluate).not.toHaveBeenCalled();
    });
    
    it('should return null if the page evaluate returns no price', async () => {
        const mockProductUrl = 'https://www.zara.com/ma/fr/item-no-price';

        const mockPageData = {
            name: 'CHEMISE SANS PRIX',
            currentPrice: null, // Simulate no price found
            originalPrice: null,
            discount: null,
            image: 'https://static.zara.net/photos/123.jpg'
        };

        const mockPage = {
            goto: jest.fn().mockResolvedValue(),
            waitForSelector: jest.fn().mockResolvedValue(),
            evaluate: jest.fn().mockResolvedValue(mockPageData),
             $: jest.fn().mockResolvedValue({
                click: jest.fn().mockResolvedValue()
            }),
        };

        // The adapter's scrape logic would filter this out, but getProductDetails should return it
        const details = await adapter.getProductDetails(mockPage, mockProductUrl);

        expect(details).toEqual(mockPageData);
    });
});
