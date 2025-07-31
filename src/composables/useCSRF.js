import { ref } from 'vue'

let csrfToken = null

export function useCSRF() {
  const fetchCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'same-origin'
      })
      if (response.ok) {
        const data = await response.json()
        csrfToken = data.csrfToken
        return csrfToken
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error)
    }
    return null
  }

  const getCSRFToken = async () => {
    if (!csrfToken) {
      await fetchCSRFToken()
    }
    return csrfToken
  }

  const fetchWithCSRF = async (url, options = {}) => {
    const token = await getCSRFToken()
    
    // Add CSRF token to headers
    const headers = {
      ...options.headers
    }
    
    // Only add CSRF token if we have one
    if (token) {
      headers['X-CSRF-Token'] = token
    }
    
    // For POST/PUT with JSON body, ensure Content-Type is set
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(options.body)
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin'
    })
    
    // If CSRF token is invalid, refresh and retry once
    if (response.status === 403) {
      const errorData = await response.json()
      if (errorData.error === 'Invalid CSRF token') {
        await fetchCSRFToken()
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken
        }
        return fetch(url, { ...options, headers, credentials: 'same-origin' })
      }
    }
    
    return response
  }

  // Initialize CSRF token when authenticated
  const initCSRF = async () => {
    await fetchCSRFToken()
  }

  return {
    getCSRFToken,
    fetchWithCSRF,
    initCSRF
  }
}