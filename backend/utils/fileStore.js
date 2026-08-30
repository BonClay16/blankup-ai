const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// In-process mutex for serializing file access per file path.
// Prevents read-modify-write races within a single Node.js process.
// For multi-process/multi-server deployments, migrate to DB-backed storage.
// ---------------------------------------------------------------------------
const locks = new Map();

function acquireLock(key) {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!locks.get(key)) {
        locks.set(key, true);
        resolve();
      } else {
        setTimeout(tryAcquire, 1);
      }
    };
    tryAcquire();
  });
}

function releaseLock(key) {
  locks.delete(key);
}

/**
 * Execute a function with exclusive access to a file path.
 * Serializes all read-modify-write operations for the same file.
 */
async function withLock(filePath, fn) {
  await acquireLock(filePath);
  try {
    return await fn();
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Read a JSON file safely. Returns [] if file not found.
 * Logs and rethrows on parse error to avoid silent data loss.
 */
function readJson(filePath) {
  try {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error(`[fileStore] Failed to read/parse ${filePath}:`, err.message);
    if (err instanceof SyntaxError) {
      try {
        const backup = `${filePath}.corrupt.${Date.now()}`;
        fs.copyFileSync(filePath, backup);
        console.error(`[fileStore] Corrupt file backed up to ${backup}`);
      } catch {}
    }
    return [];
  }
}

/**
 * Write data to a JSON file atomically (tmp + rename).
 */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    const fd = fs.openSync(tmpPath, 'r');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  } catch {}
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST') {
      try { fs.unlinkSync(filePath); } catch {}
      fs.renameSync(tmpPath, filePath);
    } else {
      try {
        fs.copyFileSync(tmpPath, filePath);
        fs.unlinkSync(tmpPath);
      } catch {
        throw err;
      }
    }
  }
}

module.exports = { readJson, writeJson, withLock, DATA_DIR };
