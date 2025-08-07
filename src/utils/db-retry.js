/**
 * Retry database operations with exponential backoff
 * @param {Function} operation - The database operation to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise} The result of the operation
 */
export async function retryDbOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (
        error.code === '23505' || // unique violation
        error.code === '23503' || // foreign key violation
        error.code === '23502' || // not null violation
        error.code === '22P02' || // invalid text representation
        error.code === '42P01' || // undefined table
        error.code === '42703'    // undefined column
      ) {
        throw error;
      }
      
      // Log retry attempt for connection errors
      if (
        error.message?.includes('timeout') ||
        error.message?.includes('terminated') ||
        error.code === 'ECONNREFUSED' ||
        error.code === '57P03' // cannot_connect_now
      ) {
        console.warn(`[DB Retry] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          console.log(`[DB Retry] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }
  
  // All retries failed
  console.error(`[DB Retry] All ${maxRetries} attempts failed`);
  throw lastError;
}

/**
 * Wrap a pool query with retry logic
 * @param {Pool} pool - The database pool
 * @param {string} query - SQL query string
 * @param {Array} values - Query parameter values
 * @returns {Promise} Query result
 */
export async function queryWithRetry(pool, query, values = []) {
  return retryDbOperation(async () => {
    return await pool.query(query, values);
  });
}