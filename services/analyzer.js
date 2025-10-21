const crypto = require('crypto');

/**
 * Normalizes a string for case-insensitive, non-alphanumeric-aware comparison.
 * @param {string} str
 * @returns {string}
 */
function normalizeForPalindrome(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Computes all required properties for a given string.
 * @param {string} value - The string to analyze.
 * @returns {object} - The properties object.
 */
function analyzeString(value) {
    const hash = crypto.createHash('sha256').update(value, 'utf8').digest('hex');
    const normalized = normalizeForPalindrome(value);
    
    // 1. Character Frequency Map & Unique Characters
    const character_frequency_map = {};
    for (const char of value) {
        character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
    }
    
    // 2. Word Count
    const word_count = value.trim().length > 0 ? value.trim().split(/\s+/).length : 0;

    // 3. Palindrome Check
    const is_palindrome = normalized === normalized.split('').reverse().join('');

    return {
        length: value.length,
        is_palindrome: is_palindrome,
        unique_characters: Object.keys(character_frequency_map).length,
        word_count: word_count,
        sha256_hash: hash,
        character_frequency_map: character_frequency_map
    };
}

module.exports = { analyzeString };