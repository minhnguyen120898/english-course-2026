# Spec: Publish Obsidian "English Course" notes as a public Quartz site

**Date:** 2026-06-15
**Status:** Approved (design)

## Goal

Publish selected notes from the Obsidian "English Course" vault as a public static
website using [Quartz v4](https://github.com/jackyzha0/quartz), hosted on GitHub Pages.
Publishing is intentional and opt-in: only notes explicitly marked `publish: true`
go live.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Static site generator | Quartz v4 |
| Hosting | GitHub Pages (public) |
| Repo | https://github.com/minhnguyen120898/english-course-2026 (already created) |
| Live URL | https://minhnguyen120898.github.io/english-course-2026/ |
| Custom domain | No (default Pages subpath URL) |
| Content sync | One-command sync script (`npm run sync`) |
| What publishes | Opt-in: only notes with `publish: true` frontmatter |
| Theme | Default Quartz theme, minimal tweaks (title, author, accent, baseUrl) |
| Deploy | Quartz's official GitHub Actions workflow on push to `main` |
| Publishing trigger | Manual `git push` (sync never auto-commits or auto-pushes) |

## Source & Environment

- **Vault source path:** `/Users/minhnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/English Course`
- **Project / repo dir:** `/Users/minhnn/Documents/workspaces/my-project/obsidian`
- **Node:** v20 (installed) — meets Quartz v4 requirement
- **Note:** macOS sandbox/iCloud permissions may block reading the vault path from
  some terminals. The sync script must fail with a clear, actionable error
  (grant Full Disk Access) rather than crashing cryptically.

## Architecture

```
iCloud Vault (English Course)          my-project/obsidian/  (git repo -> GitHub)
-----------------------------          --------------------------------------
 notes/*.md  (publish: true) --sync--> content/*.md
                                        quartz/ (engine, default theme)
                                        quartz.config.ts  (title, baseUrl, accent)
                                        scripts/sync.mjs   (the only custom code)
                                        .github/workflows/deploy.yml
                                                   |
                                                   v  git push
                                        GitHub Actions builds -> GitHub Pages
                                                   |
                                                   v
                       https://minhnguyen120898.github.io/english-course-2026/
```

### Components

- **Quartz v4** — cloned into the project dir, becomes the git repo. Provides build
  engine, default theme, full-text search, graph view, backlinks. Untouched except config.
- **`quartz.config.ts`** — minimal tweaks only:
  - `pageTitle`: site title (e.g. "English Course")
  - `baseUrl`: `minhnguyen120898.github.io/english-course-2026`
  - author + accent color
- **`scripts/sync.mjs`** — the only meaningful custom code. Populates `content/`.
- **GitHub Actions (`.github/workflows/deploy.yml`)** — Quartz's official Pages workflow;
  builds and deploys on push to `main`.

Isolation principle: the sync script is the single piece of logic we write and test.
Everything else is stock Quartz configured via one file. The vault is read-only input;
`content/` is generated output committed to the repo so Actions can build from it.

## The Sync Script (`scripts/sync.mjs`)

Small Node 20 script, run via `npm run sync`.

### Behavior (in order)

1. Read the source vault path from a named constant at the top of the file.
2. Recursively walk all `.md` files in the vault.
3. Parse frontmatter; keep only files with `publish: true`. Skip all others.
4. Wipe `content/` first (so unpublished/deleted notes disappear from the site),
   then copy each published note, preserving subfolder structure.
5. Copy attachments (images, PDFs) referenced by published notes so links don't break.
6. Print a summary, e.g. `Synced 12 notes, 4 images. Skipped 30 unpublished.`

### Boundaries (explicitly NOT done)

- No transforms of note content.
- No `git add`, no commit, no push. Sync only populates `content/`.
- Publishing remains a separate, deliberate `git push` by the user.

### Error Handling

- Vault path missing/unreadable -> clear, actionable error (grant Full Disk Access).
- Malformed frontmatter in a note -> skip it, warn by filename, continue.
- Zero published notes found -> warn loudly (do not silently produce an empty site).

## Data Flow (everyday publish loop)

```
1. In Obsidian, mark notes with `publish: true`
2. npm run sync          -> copies published notes into content/, prints summary
3. git status / git diff -> review exactly what is going live
4. git add . && git commit && git push
5. GitHub Actions builds -> live at the Pages URL in ~1-2 min
```

### Git

- `content/` **is committed** (Actions builds from the repo).
- Public notes therefore live in the public repo as well as on the site — expected,
  since the site is public. Unpublished notes never leave iCloud.
- `.gitignore`: standard Quartz ignores (`node_modules`, `.quartz-cache`, `public`).

## Testing & Verification

- **Sync script unit tests** (run against a small temp fixture vault, not real iCloud data):
  - notes with `publish: true` are included
  - notes without it, or `publish: false`, are excluded
  - malformed frontmatter is skipped with a warning
  - referenced attachments are copied
  - missing vault path produces a clear error
- **Local preview:** `npx quartz build --serve` -> view at `localhost:8080` before pushing.
- **First deploy verification:** live URL loads; base path correct (links work under
  `/english-course-2026/`); search and graph view function.

## Build Order

1. Clone Quartz v4 into the project dir; configure `quartz.config.ts`.
2. Write and test `scripts/sync.mjs`.
3. Wire `npm run sync` script + GitHub Actions deploy workflow.
4. First real sync + commit + push.
5. Verify the live site.

## Out of Scope (YAGNI for v1)

- Custom theme/branding beyond title/author/accent.
- Custom domain.
- Automated/scheduled publishing.
- Content transforms (link rewriting, stripping private sections).
