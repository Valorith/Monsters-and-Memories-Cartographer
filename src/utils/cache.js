import crypto from 'crypto';

/**
 * Simple in-memory cache with TTL support
 */
class Cache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.delete(key);
      return undefined;
    }
    
    return item.value;
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = 0) {
    // Clear existing timer if any
    this.clearTimer(key);
    
    const item = {
      value,
      expiry: ttl > 0 ? Date.now() + ttl : null
    };
    
    this.cache.set(key, item);
    
    // Set cleanup timer if TTL specified
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.clearTimer(key);
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Clear timer for a key
   * @param {string} key - Cache key
   */
  clearTimer(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Get cache size
   * @returns {number} Number of items in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }
}

// Create cache instances for different data types
export const mapsCache = new Cache();
export const leaderboardCache = new Cache();
export const userStatsCache = new Cache();

// Cache middleware factory
export function cacheMiddleware(cache, keyGenerator, ttl) {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key
    const key = typeof keyGenerator === 'function' 
      ? keyGenerator(req) 
      : keyGenerator || req.originalUrl;
    
    // Check cache
    const cached = cache.get(key);
    if (cached) {
      // Add cache hit header
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache the response
    res.json = function(data) {
      // Cache the response
      cache.set(key, data, ttl);
      
      // Add cache miss header
      res.set('X-Cache', 'MISS');
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// ETags support for conditional requests
export function etagMiddleware() {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to add ETag
    res.json = function(data) {
      // Generate ETag from response data
      const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');
      const etag = `"${hash}"`;
      
      // Set ETag header
      res.set('ETag', etag);
      
      // Check if client has matching ETag
      const clientEtag = req.get('If-None-Match');
      if (clientEtag === etag) {
        // Data hasn't changed
        return res.status(304).end();
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

export default Cache;