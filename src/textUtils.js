// Frontend text sanitization utilities

/**
 * Sanitizes user input text to prevent XSS and clean up formatting
 * @param {string} text - The input text to sanitize
 * @returns {string} - The sanitized text
 */
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let cleaned = text
    // Remove null bytes and control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Remove excessive whitespace but preserve single spaces and newlines
    .replace(/[ \t]+/g, ' ')
    // Remove multiple consecutive newlines (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Trim start and end
    .trim()

  // Remove common script injection patterns
  cleaned = cleaned
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '') // Remove any HTML tags

  // Limit length to prevent abuse
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500)
  }

  return cleaned
}

/**
 * Validates text input for basic requirements
 * @param {string} text - The text to validate
 * @returns {object} - Validation result with isValid and error message
 */
export function validateText(text) {
  const sanitized = sanitizeText(text)
  
  if (!sanitized || sanitized.length < 1) {
    return {
      isValid: false,
      error: 'Please enter some text.',
      sanitized: ''
    }
  }

  if (sanitized.length < 3) {
    return {
      isValid: false,
      error: 'Text must be at least 3 characters long.',
      sanitized
    }
  }

  if (sanitized.length > 500) {
    return {
      isValid: false,
      error: 'Text must be 500 characters or less.',
      sanitized
    }
  }

  // Check for suspicious patterns that might indicate injection attempts
  const suspiciousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /new\s+function/i,
    /document\./i,
    /window\./i,
    /\$\(/,
    /alert\s*\(/i,
    /prompt\s*\(/i,
    /confirm\s*\(/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        error: 'Text contains invalid content. Please use plain text only.',
        sanitized: ''
      }
    }
  }

  return {
    isValid: true,
    error: null,
    sanitized
  }
}

/**
 * Real-time text filtering for input fields
 * @param {string} text - The input text
 * @returns {string} - Filtered text safe for display
 */
export function filterInputText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  return text
    // Remove null bytes and most control characters
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Remove HTML tags immediately
    .replace(/<[^>]*>/g, '')
    // Limit to reasonable length during typing
    .substring(0, 500)
}
