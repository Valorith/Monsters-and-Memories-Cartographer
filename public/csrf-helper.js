// CSRF Token Helper
let csrfToken = null;

// Fetch CSRF token from server
async function fetchCSRFToken() {
  try {
    const response = await fetch('/api/csrf-token');
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
  return null;
}

// Get current CSRF token or fetch if needed
async function getCSRFToken() {
  if (!csrfToken) {
    await fetchCSRFToken();
  }
  return csrfToken;
}

// Add CSRF token to fetch options
async function fetchWithCSRF(url, options = {}) {
  const token = await getCSRFToken();
  
  // Add CSRF token to headers
  const headers = {
    ...options.headers,
    'X-CSRF-Token': token
  };
  
  // For POST/PUT with JSON body, ensure Content-Type is set
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // If CSRF token is invalid, refresh and retry once
  if (response.status === 403) {
    const errorData = await response.json();
    if (errorData.error === 'Invalid CSRF token') {
      await fetchCSRFToken();
      headers['X-CSRF-Token'] = csrfToken;
      return fetch(url, { ...options, headers });
    }
  }
  
  return response;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchCSRFToken);
} else {
  fetchCSRFToken();
}

// Export for use in other scripts
window.csrfHelper = {
  getToken: getCSRFToken,
  fetchWithCSRF
};