/**
 * diff.js
 * Compares apis-previous.json with apis-current.json and writes:
 *   ../data/latest-diff.md  — human-readable Markdown summary
 *   ../data/diff-history/   — dated archive of every diff
 *
 * An API entry is keyed by  `${API} | ${Link}`  (name + URL).
 * Category changes on an existing entry are also detected.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.resolve(__dirname, '..', 'data');
const CURRENT    = path.join(DATA_DIR, 'apis-current.json');
const PREVIOUS   = path.join(DATA_DIR, 'apis-previous.json');
const DIFF_OUT   = path.join(DATA_DIR, 'latest-diff.md');
const HIST_DIR   = path.join(DATA_DIR, 'diff-history');

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadEntries(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function buildIndex(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = `${e.API}|${e.Link}`;
    map.set(key, e);
  }
  return map;
}

function formatEntry(e) {
  const auth   = e.Auth     ? `Auth: \`${e.Auth}\`` : 'Auth: none';
  const cors   = e.Cors     ? `CORS: ${e.Cors}`     : '';
  const https  = e.HTTPS    ? '🔒 HTTPS'            : '⚠️ HTTP';
  const parts  = [auth, cors, https].filter(Boolean).join(' · ');
  return `- **[${e.API}](${e.Link})** _(${e.Category})_ — ${e.Description}\n  ${parts}`;
}

// ── Diff logic ────────────────────────────────────────────────────────────────

function computeDiff(prevEntries, currEntries) {
  const prevIndex = buildIndex(prevEntries);
  const currIndex = buildIndex(currEntries);

  const added    = [];
  const removed  = [];
  const changed  = [];

  for (const [key, curr] of currIndex) {
    if (!prevIndex.has(key)) {
      added.push(curr);
    } else {
      const prev = prevIndex.get(key);
      if (prev.Category !== curr.Category) {
        changed.push({ prev, curr });
      }
    }
  }

  for (const [key, prev] of prevIndex) {
    if (!currIndex.has(key)) removed.push(prev);
  }

  const groupBy = (arr, fn) =>
    arr.reduce((acc, item) => {
      const k = fn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});

  return {
    added:   groupBy(added,   e => e.Category),
    removed: groupBy(removed, e => e.Category),
    changed,
    counts: {
      added:   added.length,
      removed: removed.length,
      changed: changed.length,
      prev:    prevEntries.length,
      curr:    currEntries.length,
    },
  };
}

function buildMarkdown(diff, fetchedAt) {
  const { added, removed, changed, counts } = diff;
  const date = new Date(fetchedAt).toDateString();
  const lines = [];

  lines.push(`# Public APIs Sync — ${date}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Previous total | ${counts.prev} |`);
  lines.push(`| Current total  | ${counts.curr} |`);
  lines.push(`| ✅ Added        | ${counts.added} |`);
  lines.push(`| ❌ Removed      | ${counts.removed} |`);
  lines.push(`| 🔄 Category changed | ${counts.changed} |`);
  lines.push('');

  if (counts.added > 0) {
    lines.push('## ✅ New APIs');
    lines.push('');
    for (const [cat, entries] of Object.entries(added).sort()) {
      lines.push(`### ${cat}`);
      entries.forEach(e => lines.push(formatEntry(e)));
      lines.push('');
    }
  }

  if (counts.removed > 0) {
    lines.push('## ❌ Removed APIs');
    lines.push('');
    for (const [cat, entries] of Object.entries(removed).sort()) {
      lines.push(`### ${cat}`);
      entries.forEach(e => lines.push(formatEntry(e)));
      lines.push('');
    }
  }

  if (counts.changed > 0) {
    lines.push('## 🔄 Category Changes');
    lines.push('');
    changed.forEach(({ prev, curr }) => {
      lines.push(`- **${curr.API}**: \`${prev.Category}\` → \`${curr.Category}\``);
    });
    lines.push('');
  }

  if (counts.added === 0 && counts.removed === 0 && counts.changed === 0) {
    lines.push('_No changes detected this week._');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const curr = loadEntries(CURRENT);
if (!curr) {
  console.log('No current file found — skipping diff.');
  process.exit(0);
}

const prev = loadEntries(PREVIOUS);
if (!prev) {
  console.log('No previous file found — first run, nothing to diff.');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DIFF_OUT, `# Public APIs Sync — First Run\n\nBaseline of **${curr.count}** APIs captured on ${curr.fetchedAt}.\n`);
  process.exit(0);
}

const diff = computeDiff(prev.entries, curr.entries);
const md   = buildMarkdown(diff, curr.fetchedAt);

fs.writeFileSync(DIFF_OUT, md);
console.log(`Diff written to latest-diff.md`);
console.log(`  +${diff.counts.added} added  -${diff.counts.removed} removed  ~${diff.counts.changed} changed`);

fs.mkdirSync(HIST_DIR, { recursive: true });
const stamp    = curr.fetchedAt.slice(0, 10);
const archFile = path.join(HIST_DIR, `diff-${stamp}.md`);
fs.writeFileSync(archFile, md);
console.log(`Archived to diff-history/diff-${stamp}.md`);
