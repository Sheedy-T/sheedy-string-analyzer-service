const express = require('express');
const bodyParser = require('body-parser');
const { analyzeString } = require('./services/analyzer');
const storage = require('./services/storage');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

// Helper function for sending standard error responses
const sendError = (res, status, message) => {
    res.status(status).json({ error: message });
};

// --- 1. POST /strings (Create/Analyze String) ---
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


// --- 2. GET /strings/{string_value} (Get Specific String) ---
app.get('/strings/:stringValue', (req, res) => {
    const stringValue = req.params.stringValue;
    
    // Analyze the requested value to get its unique ID (hash)
    const properties = analyzeString(stringValue);
    const id = properties.sha256_hash;

    const entry = storage.getById(id);

    if (!entry) {
        return sendError(res, 404, 'String does not exist in the system');
    }

    res.status(200).json(entry);
});


// --- 3. GET /strings (Get All Strings with Filtering) ---
app.get('/strings', (req, res) => {
    const allStrings = storage.getAll();
    const filtersApplied = {};
    let filteredData = allStrings;

    // --- Validation and Filter Setup ---
    try {
        const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

        if (is_palindrome !== undefined) {
            if (is_palindrome !== 'true' && is_palindrome !== 'false') throw new Error('is_palindrome must be "true" or "false"');
            filtersApplied.is_palindrome = is_palindrome === 'true';
        }
        if (min_length !== undefined) {
            const min = parseInt(min_length);
            if (isNaN(min) || min < 0) throw new Error('min_length must be a positive integer');
            filtersApplied.min_length = min;
        }
        if (max_length !== undefined) {
            const max = parseInt(max_length);
            if (isNaN(max) || max < 0) throw new Error('max_length must be a positive integer');
            filtersApplied.max_length = max;
        }
        if (word_count !== undefined) {
            const count = parseInt(word_count);
            if (isNaN(count) || count < 0) throw new Error('word_count must be a positive integer');
            filtersApplied.word_count = count;
        }
        if (contains_character !== undefined) {
            if (typeof contains_character !== 'string' || contains_character.length !== 1) throw new Error('contains_character must be a single character string');
            filtersApplied.contains_character = contains_character;
        }

    } catch (e) {
        return sendError(res, 400, `Invalid query parameter: ${e.message}`);
    }

    // --- Filtering Logic ---
    filteredData = filteredData.filter(entry => {
        const p = entry.properties;
        
        if (filtersApplied.is_palindrome !== undefined && p.is_palindrome !== filtersApplied.is_palindrome) {
            return false;
        }
        if (filtersApplied.min_length !== undefined && p.length < filtersApplied.min_length) {
            return false;
        }
        if (filtersApplied.max_length !== undefined && p.length > filtersApplied.max_length) {
            return false;
        }
        if (filtersApplied.word_count !== undefined && p.word_count !== filtersApplied.word_count) {
            return false;
        }
        if (filtersApplied.contains_character !== undefined) {
            const char = filtersApplied.contains_character;
            if (!p.character_frequency_map[char]) {
                return false;
            }
        }
        return true;
    });

    res.status(200).json({
        data: filteredData,
        count: filteredData.length,
        filters_applied: filtersApplied
    });
});


// --- 4. GET /strings/filter-by-natural-language (Natural Language Filtering) ---
app.get('/strings/filter-by-natural-language', (req, res) => {
    const { query } = req.query;
    if (!query) {
        return sendError(res, 400, 'Missing "query" parameter for natural language filtering');
    }

    // NOTE: This is a simple, rule-based parser. For complex NLP, you'd use a dedicated library.
    const parsedFilters = {};
    const lowerQuery = query.toLowerCase();

    // Palindrome check
    if (lowerQuery.includes('palindrome') || lowerQuery.includes('palindromic')) {
        parsedFilters.is_palindrome = true;
    }

    // Word count check (simple: single word)
    if (lowerQuery.includes('single word')) {
        parsedFilters.word_count = 1;
    }

    // Length check (longer than X)
    const longerMatch = lowerQuery.match(/longer than\s+(\d+)/);
    if (longerMatch) {
        const length = parseInt(longerMatch[1]);
        // min_length in the API is inclusive, so "longer than 10" means min_length=11
        parsedFilters.min_length = length + 1; 
    }

    // Contains character (simple: "contains X" or "letter X")
    const containsMatch = lowerQuery.match(/(contains|letter)\s+([a-z])/);
    if (containsMatch) {
        parsedFilters.contains_character = containsMatch[2];
    }
    // Handle 'first vowel' heuristic (example)
    if (lowerQuery.includes('first vowel')) {
        parsedFilters.contains_character = 'a';
    }
    
    // --- Conflict Check (Simple Example) ---
    if (parsedFilters.min_length !== undefined && parsedFilters.max_length !== undefined && parsedFilters.min_length > parsedFilters.max_length) {
         return sendError(res, 422, 'Query parsed but resulted in conflicting length filters');
    }

    // Use the core filtering logic from Endpoint 3
    const allStrings = storage.getAll();
    let filteredData = allStrings;

    filteredData = filteredData.filter(entry => {
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


// --- 5. DELETE /strings/{string_value} (Delete String) ---
app.delete('/strings/:stringValue', (req, res) => {
    const stringValue = req.params.stringValue;
    
    // Re-calculate the hash to find the entry ID
    const properties = analyzeString(stringValue);
    const id = properties.sha256_hash;

    const deleted = storage.deleteById(id);

    if (!deleted) {
        return sendError(res, 404, 'String does not exist in the system');
    }

    res.status(204).send(); // 204 No Content for successful deletion
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});