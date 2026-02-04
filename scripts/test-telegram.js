/**
 * Telegram Connection Test Script
 * 
 * Tests the Telegram bot configuration
 * Usage: npm test
 */

require('dotenv').config();
const telegram = require('../src/telegram');

async function testTelegram() {
    console.log('🤖 Testing Telegram Bot Connection...\n');
    
    // Check configuration
    console.log('📋 Configuration:');
    console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Chat ID: ${process.env.TELEGRAM_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log('');

    // Test connection
    console.log('🔗 Testing bot connection...');
    const connectionResult = await telegram.testConnection();
    
    if (connectionResult.success) {
        console.log(`✅ Bot connected: @${connectionResult.botUsername} (${connectionResult.botName})`);
    } else {
        console.log(`❌ Connection failed: ${connectionResult.error}`);
        process.exit(1);
    }

    // Send test message
    console.log('\n📤 Sending test message...');
    const messageResult = await telegram.sendMessage(
        `🧪 *Test Message*\n\n` +
        `This is a test notification from the Web Scraping SaaS backend.\n\n` +
        `✅ Telegram integration is working correctly!\n\n` +
        `⏰ Time: \`${new Date().toISOString()}\``
    );

    if (messageResult.success) {
        console.log(`✅ Test message sent! (ID: ${messageResult.messageId})`);
    } else {
        console.log(`❌ Failed to send message: ${messageResult.error}`);
        process.exit(1);
    }

    // Test scrape results format
    console.log('\n📊 Sending sample scrape results...');
    const sampleResults = {
        success: true,
        url: 'https://example.com/products',
        siteType: 'test',
        scrapedAt: new Date().toISOString(),
        itemCount: 3,
        items: [
            { name: 'Sample Product 1', price: '$99.99', availability: 'In Stock', rating: '4.5 out of 5 stars' },
            { name: 'Sample Product 2', price: '$149.99', availability: 'In Stock', rating: '4.8 out of 5 stars' },
            { name: 'Sample Product 3', price: '$79.99', availability: 'Low Stock', rating: '4.2 out of 5 stars' }
        ]
    };

    const resultsMessageResult = await telegram.sendScrapeResults(sampleResults);
    
    if (resultsMessageResult.success) {
        console.log(`✅ Sample results sent! (ID: ${resultsMessageResult.messageId})`);
    } else {
        console.log(`❌ Failed to send results: ${resultsMessageResult.error}`);
    }

    console.log('\n🎉 All tests passed! Telegram integration is working correctly.');
}

testTelegram().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
