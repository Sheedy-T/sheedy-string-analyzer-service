// In-memory storage: Key is the SHA-256 hash, value is the full string object.
const dataStore = {};

function create(id, data) {
    if (dataStore[id]) {
        return null; // Conflict (String already exists)
    }
    const fullEntry = {
        id: id,
        value: data.value,
        properties: data.properties,
        created_at: new Date().toISOString()
    };
    dataStore[id] = fullEntry;
    return fullEntry;
}

function getById(id) {
    return dataStore[id];
}

function getAll() {
    return Object.values(dataStore);
}

function deleteById(id) {
    if (dataStore[id]) {
        delete dataStore[id];
        return true;
    }
    return false; // Not Found
}

module.exports = { create, getById, getAll, deleteById, dataStore };