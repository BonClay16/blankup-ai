const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Read a JSON file safely. Returns [] on error or missing file.
 * Strips BOM if present.
 */
function readJson(filePath) {
  try {
    let raw = fs.readFileSync(filePath, 'utf8');
    // Strip UTF-8 BOM
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Write data to a JSON file.
 */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { readJson, writeJson, DATA_DIR };
