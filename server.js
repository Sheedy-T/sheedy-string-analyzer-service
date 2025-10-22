const express = require('express');
const bodyParser = require('body-parser');
const { analyzeString } = require('./services/analyzer');  // ✅ fixed path
const storage = require('./services/storage');             // ✅ fixed path

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

// Helper for standardized error messages
const sendError = (res, status, message) => {
  res.status(status).json({ error: message });
};

// --- 1️⃣ POST /strings (Create/Analyze String) ---
app.post('/strings', (req, res) => {
  const value = req.body.value;

  if (value === undefined) {
    return sendError(res, 400, 'Missing "value" field in request body');
  }
  if (typeof value !== 'string') {
    return sendError(res, 422, 'Invalid data type for "value" (must be string)');
  }

  const properties = analyzeString(value);
  const id = properties.sha256_hash;

  const newEntry = storage.create(id, { value, properties });
  if (!newEntry) {
    return sendError(res, 409, 'String already exists in the system');
  }

  res.status(201).json(newEntry);
});

// --- 2️⃣ GET /strings/filter-by-natural-language (move BEFORE /:stringValue) ---
app.get('/strings/filter-by-natural-language', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return sendError(res, 400, 'Missing "query" parameter for natural language filtering');
  }

  const parsedFilters = {};
  const lowerQuery = query.toLowerCase();

  // Palindromic detection
  if (lowerQuery.includes('palindrome') || lowerQuery.includes('palindromic')) {
    parsedFilters.is_palindrome = true;
  }

  // "single word" or "one word"
  if (lowerQuery.includes('single word') || lowerQuery.includes('one word')) {
    parsedFilters.word_count = 1;
  }

  // Length checks
  const longerMatch = lowerQuery.match(/longer than\s+(\d+)/);
  if (longerMatch) parsedFilters.min_length = parseInt(longerMatch[1], 10) + 1;

  const shorterMatch = lowerQuery.match(/shorter than\s+(\d+)/);
  if (shorterMatch) parsedFilters.max_length = parseInt(shorterMatch[1], 10) - 1;

  // Character presence
  const containsMatch = lowerQuery.match(/(?:contains|letter)\s+([a-z0-9])/);
  if (containsMatch) parsedFilters.contains_character = containsMatch[1];

  // Heuristic for "first vowel"
  if (lowerQuery.includes('first vowel')) {
    parsedFilters.contains_character = 'a';
  }

  // Conflict validation
  if (parsedFilters.min_length && parsedFilters.max_length && parsedFilters.min_length > parsedFilters.max_length) {
    return sendError(res, 422, 'Query parsed but resulted in conflicting length filters');
  }

  // Filtering logic (same as GET /strings)
  const allStrings = storage.getAll();
  const filteredData = allStrings.filter(entry => {
    const p = entry.properties;
    if (parsedFilters.is_palindrome !== undefined && p.is_palindrome !== parsedFilters.is_palindrome) return false;
    if (parsedFilters.min_length !== undefined && p.length < parsedFilters.min_length) return false;
    if (parsedFilters.max_length !== undefined && p.length > parsedFilters.max_length) return false;
    if (parsedFilters.word_count !== undefined && p.word_count !== parsedFilters.word_count) return false;
    if (parsedFilters.contains_character !== undefined && !p.character_frequency_map[parsedFilters.contains_character]) return false;
    return true;
  });

  res.status(200).json({
    data: filteredData,
    count: filteredData.length,
    interpreted_query: {
      original: query,
      parsed_filters: parsedFilters
    }
  });
});

// --- 3️⃣ GET /strings/:stringValue (Specific String) ---
app.get('/strings/:stringValue', (req, res) => {
  const stringValue = req.params.stringValue;
  const properties = analyzeString(stringValue);
  const id = properties.sha256_hash;

  const entry = storage.getById(id);
  if (!entry) {
    return sendError(res, 404, 'String does not exist in the system');
  }

  res.status(200).json(entry);
});

// --- 4️⃣ GET /strings (All + Query Filters) ---
app.get('/strings', (req, res) => {
  const allStrings = storage.getAll();
  const filtersApplied = {};
  let filteredData = allStrings;

  try {
    const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

    if (is_palindrome !== undefined) {
      if (is_palindrome !== 'true' && is_palindrome !== 'false')
        throw new Error('is_palindrome must be "true" or "false"');
      filtersApplied.is_palindrome = is_palindrome === 'true';
    }

    if (min_length !== undefined) {
      const min = parseInt(min_length, 10);
      if (isNaN(min) || min < 0) throw new Error('min_length must be a positive integer');
      filtersApplied.min_length = min;
    }

    if (max_length !== undefined) {
      const max = parseInt(max_length, 10);
      if (isNaN(max) || max < 0) throw new Error('max_length must be a positive integer');
      filtersApplied.max_length = max;
    }

    if (word_count !== undefined) {
      const count = parseInt(word_count, 10);
      if (isNaN(count) || count < 0) throw new Error('word_count must be a positive integer');
      filtersApplied.word_count = count;
    }

    if (contains_character !== undefined) {
      if (typeof contains_character !== 'string' || contains_character.length !== 1)
        throw new Error('contains_character must be a single character string');
      filtersApplied.contains_character = contains_character;
    }
  } catch (e) {
    return sendError(res, 400, `Invalid query parameter: ${e.message}`);
  }

  // Filtering logic
  filteredData = filteredData.filter(entry => {
    const p = entry.properties;
    if (filtersApplied.is_palindrome !== undefined && p.is_palindrome !== filtersApplied.is_palindrome) return false;
    if (filtersApplied.min_length !== undefined && p.length < filtersApplied.min_length) return false;
    if (filtersApplied.max_length !== undefined && p.length > filtersApplied.max_length) return false;
    if (filtersApplied.word_count !== undefined && p.word_count !== filtersApplied.word_count) return false;
    if (filtersApplied.contains_character !== undefined && !p.character_frequency_map[filtersApplied.contains_character]) return false;
    return true;
  });

  res.status(200).json({
    data: filteredData,
    count: filteredData.length,
    filters_applied: filtersApplied
  });
});

// --- 5️⃣ DELETE /strings/:stringValue ---
app.delete('/strings/:stringValue', (req, res) => {
  const stringValue = req.params.stringValue;
  const properties = analyzeString(stringValue);
  const id = properties.sha256_hash;

  const deleted = storage.deleteById(id);
  if (!deleted) {
    return sendError(res, 404, 'String does not exist in the system');
  }

  res.status(204).send();
});

// Export app for testing
module.exports = app;

// Run directly
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
