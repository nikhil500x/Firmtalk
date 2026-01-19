import redisClient from '../config/redis';

/**
 * CacheService - Centralized caching helper using Redis
 * Provides simple get/set/delete operations with TTL support
 */
export class CacheService {
  /**
   * Get data from cache, or compute and store if not found
   * @param key - Cache key (should be namespaced, e.g., 'touchstone:notifications:unread:123')
   * @param fallback - Function to compute data if cache miss
   * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
   */
  static async get<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await redisClient.get(key);
      
      if (cached !== null) {
        // Cache hit - parse and return
        return JSON.parse(cached) as T;
      }
      
      // Cache miss - compute value
      const data = await fallback();
      
      // Store in cache with TTL
      await redisClient.setEx(key, ttl, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('Cache error:', error);
      // If Redis fails, fallback to computing the value
      return await fallback();
    }
  }

  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
   */
  static async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Get raw value from cache without JSON parsing
   * @param key - Cache key
   */
  static async getRaw(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      console.error('Cache get raw error:', error);
      return null;
    }
  }

  /**
   * Set raw value in cache (useful for simple counters)
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds
   */
  static async setRaw(key: string, value: string, ttl: number = 300): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, value);
    } catch (error) {
      console.error('Cache set raw error:', error);
    }
  }

  /**
   * Delete a key from cache (cache invalidation)
   * @param key - Cache key to delete
   */
  static async invalidate(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Pattern to match (e.g., 'touchstone:notifications:*')
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Increment a counter in cache
   * @param key - Cache key
   * @param ttl - Time to live in seconds (only applied on first increment)
   */
  static async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await redisClient.incr(key);
      
      // Set TTL on first increment
      if (result === 1 && ttl) {
        await redisClient.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Cache key builders for consistent naming
  static keys = {
    notificationUnreadCount: (userId: number) => 
      `touchstone:notifications:unread:${userId}`,
    notificationRecent: (userId: number) => 
      `touchstone:notifications:recent:${userId}`,
    userNotifications: (userId: number) => 
      `touchstone:notifications:user:${userId}:*`,
  };
}

export default CacheService;

