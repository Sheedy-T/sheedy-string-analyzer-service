// Simple in-memory key-value storage
// Key: SHA-256 hash
// Value: Object containing value, properties, and timestamps

const dataStore = {};

/**
 * Create a new entry (fails if hash already exists)
 * @param {string} id - SHA-256 hash
 * @param {object} data - Contains { value, properties }
 * @returns {object|null} Created entry or null if duplicate
 */
function create(id, data) {
    if (!id || !data) return null;
    if (dataStore[id]) return null; // Duplicate (conflict)

    const entry = {
        id,
        value: data.value,
        properties: data.properties,
        created_at: new Date().toISOString()
    };
    dataStore[id] = entry;
    return entry;
}

/**
 * Get an entry by its ID
 */
function getById(id) {
    return dataStore[id];
}

/**
 * Get all entries in the store
 */
function getAll() {
    return Object.values(dataStore);
}

/**
 * Delete an entry by ID
 */
function deleteById(id) {
    if (!dataStore[id]) return false;
    delete dataStore[id];
    return true;
}

module.exports = { create, getById, getAll, deleteById, dataStore };
