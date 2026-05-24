/**
 * fetch.js
 * Pulls the latest entries from the public-apis README.md on GitHub,
 * parses the markdown tables, and writes structured JSON to:
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

// Raw README from the public-apis GitHub repo
const README_URL = 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md';

// ── Markdown table parser ─────────────────────────────────────────────────────

function parseReadme(markdown) {
  const entries = [];
  let currentCategory = 'Uncategorized';

  const lines = markdown.split('\n');

  for (const line of lines) {
    // Detect category headings: ### Category Name
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      currentCategory = heading[1].trim();
      continue;
    }

    // Skip table header and separator rows
    if (line.match(/^\|\s*API\s*\|/i)) continue;
    if (line.match(/^\|[-\s|]+\|/))    continue;

    // Parse table data rows: | API | Description | Auth | HTTPS | CORS |
    const row = line.match(/^\|(.+)\|$/);
    if (!row) continue;

    const cols = row[1].split('|').map(c => c.trim());
    if (cols.length < 5) continue;

    // Extract markdown link from first column: [Name](URL)
    const linkMatch = cols[0].match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!linkMatch) continue;

    const name  = linkMatch[1].trim();
    const url   = linkMatch[2].trim();
    const desc  = cols[1];
    const auth  = cols[2] === 'null' || cols[2] === '' ? null : cols[2];
    const https = cols[3].toLowerCase() === 'yes';
    const cors  = cols[4];

    entries.push({
      API:      name,
      Description: desc,
      Auth:     auth,
      HTTPS:    https,
      Cors:     cors,
      Category: currentCategory,
      Link:     url,
    });
  }

  return entries;
}

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function rotateCurrent() {
  if (fs.existsSync(CURRENT)) {
    fs.copyFileSync(CURRENT, PREVIOUS);
    console.log('Rotated apis-current.json → apis-previous.json');
  } else {
    console.log('No existing current file — first run.');
  }
}

function writeCurrent(entries) {
  const payload = {
    fetchedAt: new Date().toISOString(),
    count:     entries.length,
    entries,
  };
  fs.writeFileSync(CURRENT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${entries.length} entries to apis-current.json`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
try {
  console.log(`Fetching README from ${README_URL} ...`);
  const res = await fetch(README_URL);

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const markdown = await res.text();
  console.log(`Downloaded ${(markdown.length / 1024).toFixed(1)} KB`);

  const entries = parseReadme(markdown);
  if (entries.length === 0) throw new Error('Parsed 0 entries — check the README format');

  console.log(`Parsed ${entries.length} API entries across ${new Set(entries.map(e => e.Category)).size} categories`);

  ensureDataDir();
  rotateCurrent();
  writeCurrent(entries);

  console.log('Fetch complete ✓');
} catch (err) {
  console.error('Fetch failed:', err.message);
  process.exit(1);
}
