const crypto = require('crypto');

/**
 * Normalize a string for case-insensitive palindrome checking:
 *  - Convert to lowercase
 *  - Remove all non-alphanumeric characters
 */
function normalizeForPalindrome(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Analyze a given string and return detailed properties.
 * @param {string} value - String to analyze
 * @returns {object} Analysis result
 */
function analyzeString(value) {
    // Ensure the input is a string (robustness)
    if (typeof value !== 'string') value = String(value);

    // SHA-256 hash (unique ID)
    const hash = crypto.createHash('sha256').update(value, 'utf8').digest('hex');

    // Normalized version for palindrome test
    const normalized = normalizeForPalindrome(value);

    // Character frequency map (exact characters, case-sensitive)
    const character_frequency_map = {};
    for (const char of value) {
        character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
    }

    // Word count (split by whitespace)
    const trimmed = value.trim();
    const word_count = trimmed.length > 0 ? trimmed.split(/\s+/).length : 0;

    // Palindrome check (case-insensitive, ignore punctuation)
    const is_palindrome = normalized === normalized.split('').reverse().join('');

    return {
        length: value.length,
        is_palindrome,
        unique_characters: Object.keys(character_frequency_map).length,
        word_count,
        sha256_hash: hash,
        character_frequency_map
    };
}

module.exports = { analyzeString };
