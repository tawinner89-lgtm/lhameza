/**
 * Test Supabase Connection
 */
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
    console.log('\n🔍 Testing Supabase Connection...\n');
    
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    console.log('URL:', url);
    console.log('Key:', key ? key.substring(0, 20) + '...' : 'NOT SET');
    
    if (!url || !key) {
        console.log('\n❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
        return;
    }
    
    try {
        const supabase = createClient(url, key);
        
        // Test 1: Check categories table
        console.log('\n📋 Testing categories table...');
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('*');
        
        if (catError) {
            console.log('❌ Categories error:', catError.message);
        } else {
            console.log('✅ Categories:', categories?.length || 0, 'found');
            if (categories?.length > 0) {
                categories.forEach(c => console.log(`   - ${c.emoji} ${c.name}`));
            }
        }
        
        // Test 2: Check sources table
        console.log('\n📋 Testing sources table...');
        const { data: sources, error: srcError } = await supabase
            .from('sources')
            .select('*');
        
        if (srcError) {
            console.log('❌ Sources error:', srcError.message);
        } else {
            console.log('✅ Sources:', sources?.length || 0, 'found');
            if (sources?.length > 0) {
                sources.forEach(s => console.log(`   - ${s.name} (${s.type})`));
            }
        }
        
        // Test 3: Check deals table
        console.log('\n📋 Testing deals table...');
        const { data: deals, error: dealError, count } = await supabase
            .from('deals')
            .select('*', { count: 'exact' })
            .limit(5);
        
        if (dealError) {
            console.log('❌ Deals error:', dealError.message);
        } else {
            console.log('✅ Deals: found (showing first 5)');
            if (deals?.length > 0) {
                deals.forEach(d => console.log(`   - ${d.title?.substring(0, 50)}... (${d.source})`));
            }
        }
        
        // Test 4: Try inserting a test deal
        console.log('\n📋 Testing insert...');
        const { data: inserted, error: insertError } = await supabase
            .from('deals')
            .insert({
                title: 'TEST - Delete Me',
                price: 100,
                category: 'tech',
                source: 'test',
                url: 'https://test.com/' + Date.now()
            })
            .select()
            .single();
        
        if (insertError) {
            console.log('❌ Insert error:', insertError.message);
            console.log('   (This might be a permissions issue)');
        } else {
            console.log('✅ Insert successful! ID:', inserted.id);
            
            // Delete test record
            await supabase.from('deals').delete().eq('id', inserted.id);
            console.log('   (Test record deleted)');
        }
        
        console.log('\n✅ Supabase connection working!\n');
        
    } catch (error) {
        console.log('\n❌ Connection failed:', error.message);
    }
}

testConnection();
