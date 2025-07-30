// Safe HTML rendering utility
// This file provides a global safeHTML function that can be used to safely render HTML content

(function() {
  // Helper function to escape HTML
  window.escapeHTML = function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  // Basic HTML sanitization without external dependencies
  window.safeHTML = function(html) {
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Define allowed tags and attributes
    const allowedTags = ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div', 'img', 'td', 'tr', 'th', 'button', 'table', 'thead', 'tbody', 'tfoot', 'select', 'option', 'input', 'label', 'small'];
    const allowedAttrs = ['class', 'style', 'src', 'alt', 'onclick', 'colspan', 'rowspan', 'disabled', 'type', 'value', 'selected', 'data-poi-id', 'data-status', 'data-action', 'data-args', 'title', 'min', 'max', 'step'];
    
    // Function to clean a node
    function cleanNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if tag is allowed
        if (!allowedTags.includes(node.tagName.toLowerCase())) {
          node.remove();
          return;
        }
        
        // Clean attributes
        const attrs = Array.from(node.attributes);
        attrs.forEach(attr => {
          if (!allowedAttrs.includes(attr.name.toLowerCase())) {
            node.removeAttribute(attr.name);
          }
        });
        
        // Clean style attribute to prevent XSS
        if (node.hasAttribute('style')) {
          const style = node.getAttribute('style');
          // Remove javascript: and expression() from styles
          if (style.match(/javascript:|expression\s*\(/i)) {
            node.removeAttribute('style');
          }
        }
        
        // Clean src attributes to prevent XSS
        if (node.hasAttribute('src')) {
          const src = node.getAttribute('src');
          if (src.match(/^javascript:/i)) {
            node.removeAttribute('src');
          }
        }
      }
    }
    
    // Walk through all nodes and clean them
    const walker = document.createTreeWalker(
      temp,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    const nodesToClean = [];
    while (walker.nextNode()) {
      nodesToClean.push(walker.currentNode);
    }
    
    nodesToClean.forEach(cleanNode);
    
    return temp.innerHTML;
  };
  
  // Function to set innerHTML safely
  window.setInnerHTML = function(element, html) {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (element) {
      element.innerHTML = window.safeHTML(html);
    }
  };
  
  console.log('Safe HTML utilities loaded successfully');
})();