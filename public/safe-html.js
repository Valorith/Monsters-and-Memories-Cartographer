// Safe HTML rendering utility using DOMPurify
// This file provides a global safeHTML function that can be used to safely render HTML content

(function() {
  // Load DOMPurify from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js';
  script.onload = function() {
    // Configure DOMPurify
    const config = {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div', 'img', 'td', 'tr', 'th', 'button', 'table', 'thead', 'tbody', 'tfoot', 'select', 'option', 'input', 'label', 'small'],
      ALLOWED_ATTR: ['class', 'style', 'src', 'alt', 'onclick', 'colspan', 'rowspan', 'disabled', 'type', 'value', 'selected', 'data-poi-id', 'data-status', 'title', 'min', 'max', 'step'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    };
    
    // Create global safeHTML function
    window.safeHTML = function(dirty) {
      return DOMPurify.sanitize(dirty, config);
    };
    
    // Also create a function to set innerHTML safely
    window.setInnerHTML = function(element, html) {
      if (typeof element === 'string') {
        element = document.getElementById(element);
      }
      if (element) {
        element.innerHTML = window.safeHTML(html);
      }
    };
    
    // Helper function to escape HTML for text content
    window.escapeHTML = function(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    console.log('Safe HTML utilities loaded successfully');
  };
  
  script.onerror = function() {
    console.error('Failed to load DOMPurify. Falling back to basic HTML escaping.');
    
    // Fallback implementation with basic escaping
    window.escapeHTML = function(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    window.safeHTML = function(html) {
      // Basic fallback - just escape everything
      return window.escapeHTML(html);
    };
    
    window.setInnerHTML = function(element, html) {
      if (typeof element === 'string') {
        element = document.getElementById(element);
      }
      if (element) {
        element.textContent = html; // Fallback to text content
      }
    };
  };
  
  document.head.appendChild(script);
})();