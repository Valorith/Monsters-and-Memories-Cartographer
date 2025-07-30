// Security utility functions for input sanitization and validation

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - Input string to escape
 * @returns {string} - Escaped string safe for HTML output
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

/**
 * Sanitize input for SQL identifiers (table names, column names)
 * @param {string} identifier - SQL identifier to sanitize
 * @returns {string} - Sanitized identifier
 */
export function sanitizeSqlIdentifier(identifier) {
  if (typeof identifier !== 'string') return '';
  
  // Only allow alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Validate and sanitize username/nickname
 * @param {string} username - Username to validate
 * @returns {object} - { isValid: boolean, sanitized: string, error?: string }
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { isValid: false, sanitized: '', error: 'Username is required' };
  }
  
  // Trim whitespace
  const trimmed = username.trim();
  
  // Check length
  if (trimmed.length < 3) {
    return { isValid: false, sanitized: trimmed, error: 'Username must be at least 3 characters' };
  }
  
  if (trimmed.length > 30) {
    return { isValid: false, sanitized: trimmed, error: 'Username must be 30 characters or less' };
  }
  
  // Allow alphanumeric, spaces, hyphens, underscores, and common unicode letters
  const usernameRegex = /^[\p{L}\p{N}\s\-_]+$/u;
  if (!usernameRegex.test(trimmed)) {
    return { isValid: false, sanitized: trimmed, error: 'Username contains invalid characters' };
  }
  
  // Prevent multiple consecutive spaces
  const normalized = trimmed.replace(/\s+/g, ' ');
  
  return { isValid: true, sanitized: normalized };
}

/**
 * Validate and sanitize POI name
 * @param {string} name - POI name to validate
 * @returns {object} - { isValid: boolean, sanitized: string, error?: string }
 */
export function validatePOIName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, sanitized: '', error: 'POI name is required' };
  }
  
  // Trim whitespace
  const trimmed = name.trim();
  
  // Check length
  if (trimmed.length < 1) {
    return { isValid: false, sanitized: trimmed, error: 'POI name cannot be empty' };
  }
  
  if (trimmed.length > 100) {
    return { isValid: false, sanitized: trimmed, error: 'POI name must be 100 characters or less' };
  }
  
  // Normalize spaces
  const normalized = trimmed.replace(/\s+/g, ' ');
  
  return { isValid: true, sanitized: normalized };
}

/**
 * Validate and sanitize description text
 * @param {string} description - Description to validate
 * @returns {object} - { isValid: boolean, sanitized: string, error?: string }
 */
export function validateDescription(description) {
  if (!description || typeof description !== 'string') {
    return { isValid: true, sanitized: '' }; // Description is optional
  }
  
  // Trim whitespace
  const trimmed = description.trim();
  
  // Check length
  if (trimmed.length > 500) {
    return { isValid: false, sanitized: trimmed, error: 'Description must be 500 characters or less' };
  }
  
  // Normalize whitespace
  const normalized = trimmed.replace(/\s+/g, ' ');
  
  return { isValid: true, sanitized: normalized };
}

/**
 * Validate emoji icon
 * @param {string} icon - Icon to validate
 * @returns {object} - { isValid: boolean, sanitized: string, error?: string }
 */
export function validateIcon(icon) {
  if (!icon || typeof icon !== 'string') {
    return { isValid: false, sanitized: '📍', error: 'Icon is required' };
  }
  
  // Check if it's a valid emoji (1-2 characters allowing for compound emojis)
  if (icon.length > 4) {
    return { isValid: false, sanitized: '📍', error: 'Icon must be a single emoji' };
  }
  
  // Basic emoji validation - check if it contains emoji-like characters
  const emojiRegex = /^[\p{Emoji}\p{Emoji_Component}]+$/u;
  if (!emojiRegex.test(icon)) {
    return { isValid: false, sanitized: '📍', error: 'Invalid emoji icon' };
  }
  
  return { isValid: true, sanitized: icon };
}

/**
 * Validate numeric ID
 * @param {any} id - ID to validate
 * @returns {object} - { isValid: boolean, value: number, error?: string }
 */
export function validateId(id) {
  const parsed = parseInt(id, 10);
  
  if (isNaN(parsed) || parsed < 1) {
    return { isValid: false, value: 0, error: 'Invalid ID' };
  }
  
  return { isValid: true, value: parsed };
}

/**
 * Validate coordinates
 * @param {any} x - X coordinate
 * @param {any} y - Y coordinate
 * @returns {object} - { isValid: boolean, x: number, y: number, error?: string }
 */
export function validateCoordinates(x, y) {
  const parsedX = parseFloat(x);
  const parsedY = parseFloat(y);
  
  if (isNaN(parsedX) || isNaN(parsedY)) {
    return { isValid: false, x: 0, y: 0, error: 'Invalid coordinates' };
  }
  
  // Check reasonable bounds (adjust based on your map size)
  if (parsedX < -10000 || parsedX > 10000 || parsedY < -10000 || parsedY > 10000) {
    return { isValid: false, x: parsedX, y: parsedY, error: 'Coordinates out of bounds' };
  }
  
  return { isValid: true, x: parsedX, y: parsedY };
}

/**
 * Sanitize JSON input
 * @param {string} jsonString - JSON string to parse
 * @returns {object} - { isValid: boolean, data: any, error?: string }
 */
export function sanitizeJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return { isValid: true, data: parsed };
  } catch (error) {
    return { isValid: false, data: null, error: 'Invalid JSON format' };
  }
}

/**
 * Create a safe error message (no sensitive data)
 * @param {Error} error - Error object
 * @returns {string} - Safe error message
 */
export function getSafeErrorMessage(error) {
  // Never expose stack traces or system paths
  const safeMessages = {
    'ECONNREFUSED': 'Unable to connect to the service',
    'ETIMEDOUT': 'Request timed out',
    'ENOTFOUND': 'Service not found',
    'ER_DUP_ENTRY': 'This item already exists',
    'ER_NO_REFERENCED_ROW': 'Referenced item not found',
    '23505': 'This item already exists', // PostgreSQL unique violation
    '23503': 'Referenced item not found', // PostgreSQL foreign key violation
  };
  
  // Check for known error codes
  const errorCode = error.code || error.errno;
  if (errorCode && safeMessages[errorCode]) {
    return safeMessages[errorCode];
  }
  
  // Generic messages for common scenarios
  if (error.message) {
    if (error.message.includes('duplicate')) return 'This item already exists';
    if (error.message.includes('not found')) return 'Item not found';
    if (error.message.includes('unauthorized')) return 'Unauthorized access';
    if (error.message.includes('forbidden')) return 'Access forbidden';
  }
  
  // Default safe message
  return 'An error occurred. Please try again.';
}