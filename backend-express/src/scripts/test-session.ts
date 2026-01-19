/**
 * Test script to verify session and cookie configuration
 * Run with: npx tsx src/scripts/test-session.ts
 */

import redisClient from '../config/redis.js';

async function testSession() {
  console.log('🔍 Testing Session Configuration...\n');

  // 1. Test Redis connection
  console.log('1. Testing Redis connection...');
  try {
    await redisClient.connect();
    const pong = await redisClient.ping();
    console.log('   ✅ Redis connected:', pong);
  } catch (error) {
    console.error('   ❌ Redis connection failed:', error);
    process.exit(1);
  }

  // 2. Check for existing sessions
  console.log('\n2. Checking for existing sessions in Redis...');
  try {
    const keys = await redisClient.keys('touchstone:sess:*');
    console.log(`   Found ${keys.length} session(s) in Redis`);
    if (keys.length > 0) {
      console.log('   Sample session keys:', keys.slice(0, 3));
    }
  } catch (error) {
    console.error('   ❌ Error checking sessions:', error);
  }

  // 3. Test session store
  console.log('\n3. Testing session store...');
  try {
    const testKey = 'touchstone:sess:test-session-id';
    await redisClient.setEx(testKey, 3600, JSON.stringify({ test: 'data' }));
    const testData = await redisClient.get(testKey);
    await redisClient.del(testKey);
    if (testData) {
      console.log('   ✅ Session store is working');
    } else {
      console.log('   ❌ Session store test failed');
    }
  } catch (error) {
    console.error('   ❌ Session store test error:', error);
  }

  // 4. Display configuration
  console.log('\n4. Session Configuration:');
  console.log('   - Cookie name: touchstone.sid');
  console.log('   - Cookie secure:', process.env.NODE_ENV === 'production' ? 'true (HTTPS)' : 'false (HTTP)');
  console.log('   - Cookie sameSite: lax');
  console.log('   - Cookie path: /');
  console.log('   - Cookie domain: undefined (auto)');
  console.log('   - Session secret:', process.env.SESSION_SECRET ? '✅ Set' : '❌ NOT SET');

  console.log('\n✅ Session test complete!');
  await redisClient.quit();
  process.exit(0);
}

testSession().catch(console.error);

