# public-apis-tracker

Automated weekly sync of [public-apis/public-apis](https://github.com/public-apis/public-apis) via GitHub Actions.

## What it does

| Step | Details |
|------|---------|
| **Fetch** | Pulls the full entry list from `api.publicapis.org/entries` every Sunday at 8 AM UTC |
| **Diff** | Compares against the prior week's snapshot; detects added, removed, and recategorized APIs |
| **Commit** | Writes updated JSON + Markdown diff back to `data/` and auto-commits |
| **Artifact** | Uploads `latest-diff.md` as a downloadable Actions artifact (kept 90 days) |
| **Summary** | Posts the diff inline to the GitHub Actions run summary page |

## File layout

```
data/
  apis-current.json     ← Full dataset from most recent run
  apis-previous.json    ← Snapshot from the run before that
  latest-diff.md        ← Diff from the most recent run
  diff-history/
    diff-YYYY-MM-DD.md  ← Archived diffs, one per run

scripts/
  fetch.js              ← Pulls & rotates JSON data
  diff.js               ← Computes diff and writes Markdown

.github/workflows/
  sync-public-apis.yml  ← The Action definition
```

## Running locally

```bash
cd scripts
node fetch.js   # Fetch latest data
node diff.js    # Generate diff report
```

## Triggering manually

Go to **Actions → Sync Public APIs → Run workflow** in the GitHub UI.
