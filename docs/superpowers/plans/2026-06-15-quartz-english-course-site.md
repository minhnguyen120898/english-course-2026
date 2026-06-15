# Quartz English Course Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish opt-in notes from the Obsidian "English Course" vault as a public Quartz v4 site on GitHub Pages.

**Architecture:** Clone Quartz v4 into the existing repo dir. A single custom Node script (`scripts/sync.mjs`) copies only notes with `publish: true` frontmatter (plus their attachments) from the iCloud vault into Quartz's `content/` folder. The user reviews, commits, and pushes manually; GitHub Actions builds and deploys to Pages. The sync script is the only logic we write and test — everything else is stock Quartz configured via one file.

**Tech Stack:** Quartz v4, Node 20 (local) / Node 22 (GitHub CI), gray-matter (frontmatter parsing), Node's built-in `node:test`, GitHub Pages + Actions.

---

## Environment Notes (read before starting)

- **Repo dir:** `/Users/minhnn/Documents/workspaces/my-project/obsidian` (already a git repo on `main`; contains `docs/`, `.gitignore`, `.claude/`).
- **Vault source:** `/Users/minhnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/English Course`
- **GitHub repo:** `https://github.com/minhnguyen120898/english-course-2026` (already created, empty).
- **Live URL target:** `https://minhnguyen120898.github.io/english-course-2026/`
- **Node version conflict:** Current Quartz (v5) needs Node 22, but this machine has Node 20. This plan pins to **Quartz v4**, which runs on Node 20. GitHub CI uses Node 22 (set in the workflow) so the published build is unaffected. If the user later upgrades to Node 22, migrating to Quartz v5 is a separate effort, out of scope here.
- **iCloud permissions:** Reading the vault path may require granting the terminal app Full Disk Access in macOS System Settings. The sync script must detect and report this clearly.
- **Cloning Quartz into a non-empty dir:** Because the repo already has `docs/`, `.gitignore`, etc., we clone Quartz into a temp dir and copy its files in (Task 1), rather than `git clone` directly over the existing repo.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `quartz/`, `quartz.config.ts`, `quartz.layout.ts`, `package.json`, etc. | Stock Quartz v4 engine + config (from clone). `quartz.config.ts` edited for title/baseUrl. |
| `content/` | Generated output: published notes + attachments. Committed (CI builds from it). |
| `scripts/sync.mjs` | The only custom code. Copies `publish: true` notes + attachments from vault → `content/`. |
| `scripts/sync.test.mjs` | Unit tests for the sync script, run against a temp fixture vault. |
| `.github/workflows/deploy.yml` | GitHub Actions: build Quartz on push to `main`, deploy to Pages. |
| `.gitignore` | Quartz ignores merged with existing. |
| `package.json` | Add `"sync"` and `"test"` scripts; add `gray-matter` dev dependency. |

---

## Task 1: Scaffold Quartz v4 into the repo

**Files:**
- Create: many (Quartz engine files), via copy from a clone.
- Modify: `.gitignore`

- [ ] **Step 1: Verify Node version is 20+**

Run: `node -v`
Expected: `v20.x` or higher. If below v20, stop — Quartz v4 will not run.

- [ ] **Step 2: Clone Quartz v4 into a temp dir**

```bash
cd /Users/minhnn/Documents/workspaces/my-project/obsidian
git clone -b v4 --depth 1 https://github.com/jackyzha0/quartz.git /tmp/quartz-v4
```

Expected: clone succeeds, `/tmp/quartz-v4` contains `quartz.config.ts`, `package.json`, `quartz/`, `content/`.

- [ ] **Step 3: Copy Quartz files into the repo (excluding its .git and CI)**

```bash
cd /tmp/quartz-v4
rm -rf .git
cp -R quartz quartz.config.ts quartz.layout.ts package.json package-lock.json tsconfig.json globals.d.ts index.d.ts /Users/minhnn/Documents/workspaces/my-project/obsidian/ 2>/dev/null
cp -R content /Users/minhnn/Documents/workspaces/my-project/obsidian/ 2>/dev/null || true
```

Expected: repo dir now contains `quartz/`, `quartz.config.ts`, `package.json`.

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/minhnn/Documents/workspaces/my-project/obsidian
npm install
```

Expected: `node_modules/` created, no fatal errors (engine warnings about Node version are acceptable on v20 for Quartz v4).

- [ ] **Step 5: Verify Quartz builds and serves**

Run: `npx quartz build --serve`
Expected: builds the default content, serves at `http://localhost:8080`. Stop the server (Ctrl+C) after confirming.

- [ ] **Step 6: Merge .gitignore**

Ensure `.gitignore` contains these lines (some may already exist — do not duplicate):

```
node_modules/
.quartz-cache/
public/
.DS_Store
private/
```

- [ ] **Step 7: Commit**

```bash
cd /Users/minhnn/Documents/workspaces/my-project/obsidian
git add -A
git commit -m "chore: scaffold Quartz v4 into repo"
```

---

## Task 2: Configure site identity (title + baseUrl)

**Files:**
- Modify: `quartz.config.ts`

- [ ] **Step 1: Set pageTitle and baseUrl**

In `quartz.config.ts`, inside the `configuration` object, set these two fields (leave everything else as default):

```ts
pageTitle: "English Course",
baseUrl: "minhnguyen120898.github.io/english-course-2026",
```

Note: `baseUrl` must NOT include `https://`, and must have no leading or trailing slash. The subpath (`/english-course-2026`) is required because this is a project page, not a user page — it makes internal links resolve correctly under the subpath.

- [ ] **Step 2: Verify the build still serves with new config**

Run: `npx quartz build --serve`
Expected: serves at `http://localhost:8080`, browser tab title shows "English Course". Ctrl+C after confirming.

- [ ] **Step 3: Commit**

```bash
git add quartz.config.ts
git commit -m "feat: set site title and baseUrl for GitHub Pages"
```

---

## Task 3: Add gray-matter dependency and npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install gray-matter**

```bash
npm install --save-dev gray-matter
```

Expected: `gray-matter` appears in `devDependencies` of `package.json`.

- [ ] **Step 2: Add `sync` and `test` scripts**

In `package.json`, add to the `"scripts"` object (keep existing Quartz scripts intact):

```json
"sync": "node scripts/sync.mjs",
"test": "node --test scripts/"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gray-matter and sync/test npm scripts"
```

---

## Task 4: Sync script — frontmatter filtering (TDD)

This task builds the core: walk the vault, keep only `publish: true` notes. We build it test-first against a temporary fixture vault so tests never touch real iCloud data.

**Files:**
- Create: `scripts/sync.mjs`
- Create: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the failing test for frontmatter filtering**

Create `scripts/sync.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncVault } from "./sync.mjs";

async function makeVault() {
  const dir = await mkdtemp(join(tmpdir(), "vault-"));
  return dir;
}

async function makeContent() {
  const dir = await mkdtemp(join(tmpdir(), "content-"));
  return dir;
}

test("includes notes with publish: true and excludes others", async () => {
  const vault = await makeVault();
  const content = await makeContent();
  await writeFile(join(vault, "yes.md"), "---\npublish: true\n---\n# Yes\n");
  await writeFile(join(vault, "no.md"), "---\npublish: false\n---\n# No\n");
  await writeFile(join(vault, "none.md"), "# No frontmatter\n");

  const result = await syncVault({ vaultDir: vault, contentDir: content });

  const files = await readdir(content);
  assert.deepEqual(files.sort(), ["yes.md"]);
  assert.equal(result.synced, 1);
  assert.equal(result.skipped, 2);

  await rm(vault, { recursive: true, force: true });
  await rm(content, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `Cannot find module './sync.mjs'` or `syncVault is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/sync.mjs`:

```js
import { readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import matter from "gray-matter";

// Default real vault location; overridable for tests.
export const DEFAULT_VAULT_DIR =
  "/Users/minhnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/English Course";
export const DEFAULT_CONTENT_DIR = new URL("../content/", import.meta.url).pathname;

async function walkMarkdown(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(full, base, acc);
    } else if (entry.name.endsWith(".md")) {
      acc.push({ full, rel: relative(base, full) });
    }
  }
  return acc;
}

export async function syncVault({ vaultDir, contentDir }) {
  const mdFiles = await walkMarkdown(vaultDir);
  let synced = 0;
  let skipped = 0;

  for (const { full, rel } of mdFiles) {
    const raw = await readFile(full, "utf8");
    let data;
    try {
      ({ data } = matter(raw));
    } catch {
      skipped += 1;
      continue;
    }
    if (data && data.publish === true) {
      const dest = join(contentDir, rel);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, raw);
      synced += 1;
    } else {
      skipped += 1;
    }
  }

  return { synced, skipped };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs scripts/sync.test.mjs
git commit -m "feat: sync script filters notes by publish frontmatter"
```

---

## Task 5: Sync script — clean content/ before copying (TDD)

Ensures unpublished or deleted notes disappear from the site on each sync.

**Files:**
- Modify: `scripts/sync.mjs`
- Modify: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/sync.test.mjs`:

```js
test("wipes stale files from content before syncing", async () => {
  const vault = await makeVault();
  const content = await makeContent();
  await writeFile(join(content, "stale.md"), "old content");
  await writeFile(join(vault, "fresh.md"), "---\npublish: true\n---\n# Fresh\n");

  await syncVault({ vaultDir: vault, contentDir: content });

  const files = await readdir(content);
  assert.deepEqual(files.sort(), ["fresh.md"]);

  await rm(vault, { recursive: true, force: true });
  await rm(content, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `stale.md` still present, so `deepEqual` fails.

- [ ] **Step 3: Implement the wipe**

In `scripts/sync.mjs`, at the start of `syncVault` (before walking), add a clean step. Replace the opening of `syncVault` with:

```js
export async function syncVault({ vaultDir, contentDir }) {
  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });

  const mdFiles = await walkMarkdown(vaultDir);
  let synced = 0;
  let skipped = 0;
```

(Leave the rest of the function unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs scripts/sync.test.mjs
git commit -m "feat: wipe content dir before each sync"
```

---

## Task 6: Sync script — copy referenced attachments (TDD)

Published notes may embed images/PDFs. Copy any attachment referenced by a published note so links don't break.

**Files:**
- Modify: `scripts/sync.mjs`
- Modify: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/sync.test.mjs`:

```js
test("copies attachments referenced by published notes", async () => {
  const vault = await makeVault();
  const content = await makeContent();
  await mkdir(join(vault, "assets"), { recursive: true });
  await writeFile(join(vault, "assets", "pic.png"), "PNGDATA");
  await writeFile(
    join(vault, "note.md"),
    "---\npublish: true\n---\n![pic](assets/pic.png)\n",
  );

  const result = await syncVault({ vaultDir: vault, contentDir: content });

  const assetFiles = await readdir(join(content, "assets"));
  assert.deepEqual(assetFiles, ["pic.png"]);
  assert.equal(result.assets, 1);

  await rm(vault, { recursive: true, force: true });
  await rm(content, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `content/assets` does not exist, or `result.assets` is undefined.

- [ ] **Step 3: Implement attachment copying**

In `scripts/sync.mjs`, replace the `syncVault` copy loop and return so it also extracts and copies attachments. Use this full updated function body (replacing the existing `syncVault`):

```js
const ATTACHMENT_RE = /!\[[^\]]*\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g;

function extractAttachments(raw) {
  const found = new Set();
  let m;
  while ((m = ATTACHMENT_RE.exec(raw)) !== null) {
    const ref = (m[1] || m[2] || "").trim();
    if (!ref) continue;
    if (ref.startsWith("http://") || ref.startsWith("https://")) continue;
    if (ref.endsWith(".md")) continue;
    found.add(ref.split("#")[0].split("|")[0].trim());
  }
  return [...found];
}

export async function syncVault({ vaultDir, contentDir }) {
  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });

  const mdFiles = await walkMarkdown(vaultDir);
  let synced = 0;
  let skipped = 0;
  let assets = 0;

  for (const { full, rel } of mdFiles) {
    const raw = await readFile(full, "utf8");
    let data;
    try {
      ({ data } = matter(raw));
    } catch {
      skipped += 1;
      continue;
    }
    if (!(data && data.publish === true)) {
      skipped += 1;
      continue;
    }

    const dest = join(contentDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, raw);
    synced += 1;

    for (const ref of extractAttachments(raw)) {
      const srcPath = join(vaultDir, ref);
      try {
        await stat(srcPath);
      } catch {
        continue; // referenced asset missing in vault; skip silently
      }
      const assetDest = join(contentDir, ref);
      await mkdir(dirname(assetDest), { recursive: true });
      const bytes = await readFile(srcPath);
      await writeFile(assetDest, bytes);
      assets += 1;
    }
  }

  return { synced, skipped, assets };
}
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs scripts/sync.test.mjs
git commit -m "feat: copy attachments referenced by published notes"
```

---

## Task 7: Sync script — error handling for missing vault and empty result (TDD)

**Files:**
- Modify: `scripts/sync.mjs`
- Modify: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to `scripts/sync.test.mjs`:

```js
test("throws a clear error when the vault path is missing", async () => {
  const content = await makeContent();
  await assert.rejects(
    () => syncVault({ vaultDir: "/no/such/vault/path", contentDir: content }),
    /Vault path not found or unreadable/,
  );
  await rm(content, { recursive: true, force: true });
});

test("reports zero published notes without throwing", async () => {
  const vault = await makeVault();
  const content = await makeContent();
  await writeFile(join(vault, "draft.md"), "---\npublish: false\n---\n# Draft\n");

  const result = await syncVault({ vaultDir: vault, contentDir: content });
  assert.equal(result.synced, 0);

  await rm(vault, { recursive: true, force: true });
  await rm(content, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify the missing-vault test fails**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — the missing-vault case currently throws a raw `ENOENT`, not the friendly message.

- [ ] **Step 3: Implement the vault-existence check**

In `scripts/sync.mjs`, at the very start of `syncVault` (before the `rm`/`mkdir` of contentDir), add:

```js
  try {
    const s = await stat(vaultDir);
    if (!s.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error(
      `Vault path not found or unreadable: ${vaultDir}\n` +
        "If the path exists, grant your terminal Full Disk Access in " +
        "System Settings > Privacy & Security > Full Disk Access, then retry.",
    );
  }
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs scripts/sync.test.mjs
git commit -m "feat: clear errors for missing vault and empty publish set"
```

---

## Task 8: Sync script — CLI entrypoint with summary output

Wire `syncVault` to run from the command line with a printed summary and a loud warning when nothing is published.

**Files:**
- Modify: `scripts/sync.mjs`

- [ ] **Step 1: Add the CLI runner**

At the bottom of `scripts/sync.mjs`, add:

```js
// Run as CLI: `npm run sync`
if (import.meta.url === `file://${process.argv[1]}`) {
  syncVault({ vaultDir: DEFAULT_VAULT_DIR, contentDir: DEFAULT_CONTENT_DIR })
    .then(({ synced, skipped, assets }) => {
      console.log(
        `Synced ${synced} notes, ${assets} attachments. ` +
          `Skipped ${skipped} unpublished.`,
      );
      if (synced === 0) {
        console.warn(
          "WARNING: 0 notes had `publish: true`. The site will be empty. " +
            "Add `publish: true` frontmatter to notes you want to publish.",
        );
      }
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Verify tests still pass (CLI block must not run during import)**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS (5 tests) — the CLI block is guarded by the `import.meta.url` check, so importing for tests does not trigger it.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync.mjs
git commit -m "feat: add sync CLI entrypoint with summary output"
```

---

## Task 9: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Dependencies
        run: npm ci
      - name: Build Quartz
        run: npx quartz build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Note: this triggers on `main` (not the upstream default `v4`), and CI uses Node 22 so the build matches current Quartz tooling regardless of the local Node 20.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow on push to main"
```

---

## Task 10: First real sync, push, and connect GitHub remote

**Files:**
- Modify: `content/` (generated)

- [ ] **Step 1: Mark at least one real note for publishing**

In Obsidian, open a note in the English Course vault and add frontmatter at the top:

```
---
publish: true
---
```

Save it. (Pick a note safe to make public — this is a live test of the pipeline.)

- [ ] **Step 2: Run the sync**

```bash
cd /Users/minhnn/Documents/workspaces/my-project/obsidian
npm run sync
```

Expected: prints e.g. `Synced 1 notes, 0 attachments. Skipped N unpublished.` If it errors with the Full Disk Access message, grant access (System Settings > Privacy & Security > Full Disk Access > add your terminal app) and retry.

- [ ] **Step 3: Preview locally**

Run: `npx quartz build --serve`
Expected: serves at `http://localhost:8080`; your published note appears. Ctrl+C after confirming.

- [ ] **Step 4: Review what will go public**

```bash
git status
git add content/
git diff --cached --stat
```

Expected: only the intended published note(s) and their attachments are staged.

- [ ] **Step 5: Connect the GitHub remote and push**

```bash
git remote add origin https://github.com/minhnguyen120898/english-course-2026.git
git add -A
git commit -m "feat: first publish of English Course notes"
git branch -M main
git push -u origin main
```

Expected: push succeeds; the Actions workflow starts on GitHub.

- [ ] **Step 6: Enable GitHub Pages source**

In the GitHub repo: Settings > Pages > Build and deployment > Source = **GitHub Actions**.

- [ ] **Step 7: Verify the live site**

After the Actions run completes (~1–2 min), open `https://minhnguyen120898.github.io/english-course-2026/`.
Expected: site loads; the published note is visible; internal links resolve under the `/english-course-2026/` subpath; search and graph view work.

---

## Everyday Publish Loop (post-setup reference)

```
1. In Obsidian, add `publish: true` to notes you want live
2. npm run sync          # copies published notes + attachments into content/
3. git status / git diff # review exactly what is going public
4. git add . && git commit -m "..." && git push
5. GitHub Actions rebuilds; live in ~1–2 min
```

---

## Self-Review

**Spec coverage:**
- GitHub Pages + public + repo `english-course-2026` → Tasks 2, 9, 10. ✓
- Sync script copying only `publish: true` → Task 4. ✓
- Wipe content before sync (unpublish/delete removal) → Task 5. ✓
- Copy attachments → Task 6. ✓
- Error handling: missing vault path (Full Disk Access), malformed frontmatter skip, zero-published warning → Tasks 4 (malformed skip via try/catch), 7 (missing vault + empty set), 8 (zero-published warning). ✓
- No auto-commit/push; manual review → Task 10 steps 4–5. ✓
- `content/` committed; standard gitignore → Tasks 1 (gitignore), 10 (commit content). ✓
- Default theme, minimal tweaks (title/baseUrl) → Task 2. ✓
- Unit tests against fixture vault + local preview + first-deploy verification → Tasks 4–7 (tests), 10 (preview + live verify). ✓
- Build order (clone+config → sync+test → wire scripts/CI → sync+push → verify) → Tasks 1–10 in order. ✓

**Node version conflict** (spec said "Quartz v4"; current Quartz is v5/Node 22) is resolved explicitly: pin to Quartz v4 for Node 20 local, Node 22 in CI. Documented in Environment Notes + Task 9.

**Placeholder scan:** No TBD/TODO; all code steps contain full code; all commands have expected output.

**Type consistency:** `syncVault({ vaultDir, contentDir })` signature and its return shape `{ synced, skipped, assets }` are consistent across Tasks 4–8. `DEFAULT_VAULT_DIR` / `DEFAULT_CONTENT_DIR` names consistent between Task 4 definition and Task 8 usage.
