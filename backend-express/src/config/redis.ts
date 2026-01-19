import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: 'redis://localhost:6379'
});

// Connect the client
redisClient.connect().catch(console.error);

// Handle connection events
redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

export default redisClient;