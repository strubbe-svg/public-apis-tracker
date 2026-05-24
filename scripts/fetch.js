/**
 * fetch.js
 * Pulls the latest entries from publicapis.org and writes them to:
 *   ../data/apis-current.json   — full dataset (overwritten each run)
 *   ../data/apis-previous.json  — snapshot of the prior run (for diffing)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, '..', 'data');
const CURRENT   = path.join(DATA_DIR, 'apis-current.json');
const PREVIOUS  = path.join(DATA_DIR, 'apis-previous.json');

const ENDPOINT  = 'https://api.publicapis.org/entries';

async function fetchEntries() {
  console.log(`Fetching from ${ENDPOINT} ...`);

  const res = await fetch(ENDPOINT);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${ENDPOINT}`);
  }

  const json = await res.json();

  if (!json.entries || !Array.isArray(json.entries)) {
    throw new Error('Unexpected response shape — missing "entries" array');
  }

  return json;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function rotateCurrent() {
  // Move current → previous before overwriting
  if (fs.existsSync(CURRENT)) {
    fs.copyFileSync(CURRENT, PREVIOUS);
    console.log('Rotated apis-current.json → apis-previous.json');
  } else {
    console.log('No existing current file — first run.');
  }
}

function writeCurrent(data) {
  const payload = {
    fetchedAt: new Date().toISOString(),
    count:     data.entries.length,
    entries:   data.entries,
  };
  fs.writeFileSync(CURRENT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${data.entries.length} entries to apis-current.json`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
try {
  ensureDataDir();
  rotateCurrent();
  const data = await fetchEntries();
  writeCurrent(data);
  console.log('Fetch complete ✓');
} catch (err) {
  console.error('Fetch failed:', err.message);
  process.exit(1);
}
