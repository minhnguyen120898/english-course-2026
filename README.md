# English Course

My English course notes, published as a static website with [Quartz v4](https://quartz.jzhao.xyz/) and hosted on GitHub Pages.

**Live site:** https://minhnguyen120898.github.io/english-course-2026/

## How it works

Notes live in an Obsidian vault. Only notes with `publish: true` in their
frontmatter are published — publishing is opt-in, so nothing goes live by
accident. A sync script copies published notes (and their image attachments)
from the vault into Quartz's `content/` folder. Pushing to `main` triggers a
GitHub Actions workflow that builds the site and deploys it to GitHub Pages.

```
Obsidian vault (publish: true)  ──sync──▶  content/  ──build──▶  GitHub Pages
```

## Publishing workflow

1. **Mark notes for publishing.** Add frontmatter to any note you want public:

   ```
   ---
   publish: true
   ---
   ```

   To bulk-add `publish: true` to every note in the vault:

   ```bash
   node scripts/add-publish.mjs --dry   # preview what would change
   node scripts/add-publish.mjs         # apply
   ```

2. **Sync** published notes into `content/`:

   ```bash
   npm run sync
   ```

   Prints a summary, e.g. `Synced 18 notes, 0 attachments, 1 static pages.`

3. **Preview locally** (optional):

   ```bash
   npx quartz build --serve   # http://localhost:8080
   ```

4. **Review, commit, and push** — this is what makes it public:

   ```bash
   git status            # see exactly what will go live
   git add .
   git commit -m "publish: update notes"
   git push
   ```

5. GitHub Actions rebuilds and deploys. The site is live in ~1–2 minutes.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run sync` | Copy `publish: true` notes + attachments from the vault into `content/`. Wipes `content/` first, so unpublished or deleted notes drop off the site. |
| `npm run test:sync` | Run the sync script's unit tests. |
| `node scripts/add-publish.mjs` | Bulk-add `publish: true` to every note in the vault (`--dry` to preview). Merge-aware: preserves existing frontmatter. |
| `npx quartz build --serve` | Build and preview the site locally at `localhost:8080`. |

## Project layout

| Path | Responsibility |
|------|----------------|
| `content/` | Generated output (published notes + landing page). Committed so CI builds from it. |
| `content-static/` | Durable pages copied on every sync (e.g. `index.md` landing page). |
| `scripts/sync.mjs` | Vault → `content/` sync; filters by `publish: true`, copies attachments, excludes audio/video. |
| `scripts/add-publish.mjs` | One-shot bulk frontmatter helper. |
| `quartz.config.ts` | Site title, `baseUrl`, theme. |
| `.github/workflows/deploy.yml` | Build + deploy to GitHub Pages on push to `main`. |

## Notes

- **Source vault path** is configured at the top of `scripts/sync.mjs`. The vault
  lives under iCloud, so the terminal needs **Full Disk Access**
  (System Settings → Privacy & Security → Full Disk Access) to read it.
- **Audio/video attachments** (`.m4a`, `.mp3`, `.mp4`, …) are excluded from
  publishing by design.
- **Requirements:** Node 20+ locally (Quartz v4). GitHub CI builds on Node 22.

## Documentation

Design and implementation notes live in
[`docs/superpowers/`](docs/superpowers/) — the spec and the task-by-task plan.
