import crypto from 'crypto';

/**
 * Generate unique card code
 * Format: CARD-2024-XXXX-XXXX
 */
export function generateCardCode() {
  const year = new Date().getFullYear();
  const random1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CARD-${year}-${random1}-${random2}`;
}

/**
 * Generate multiple card codes
 * @param {number} count - Number of cards to generate
 * @param {number} credits - Credits per card
 * @param {number} expiryDays - Days until expiry (null for no expiry)
 * @returns {Array} Array of card objects
 */
export function generateCards(count, credits, expiryDays = null) {
  const cards = [];
  const expiresAt = expiryDays 
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    : null;
  
  for (let i = 0; i < count; i++) {
    cards.push({
      card_code: generateCardCode(),
      credits: credits,
      expires_at: expiresAt
    });
  }
  
  return cards;
}

/**
 * Validate card code format
 * @param {string} cardCode - Card code to validate
 * @returns {boolean} True if valid format
 */
export function validateCardCodeFormat(cardCode) {
  const pattern = /^CARD-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  return pattern.test(cardCode);
}
