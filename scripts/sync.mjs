import { readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import matter from "gray-matter";

// Default real vault location; overridable for tests.
export const DEFAULT_VAULT_DIR =
  "/Users/minhnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/English Course";
export const DEFAULT_CONTENT_DIR = new URL("../content/", import.meta.url).pathname;
export const DEFAULT_STATIC_DIR = new URL("../content-static/", import.meta.url)
  .pathname;

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

const ATTACHMENT_RE = /!\[[^\]]*\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g;

// Audio/video attachments are excluded from publishing (often personal recordings).
const EXCLUDED_ATTACHMENT_EXT = new Set([
  ".m4a",
  ".mp3",
  ".wav",
  ".aac",
  ".ogg",
  ".flac",
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
]);

function extName(ref) {
  const dot = ref.lastIndexOf(".");
  return dot === -1 ? "" : ref.slice(dot).toLowerCase();
}

function extractAttachments(raw) {
  const found = new Set();
  let m;
  while ((m = ATTACHMENT_RE.exec(raw)) !== null) {
    const ref = (m[1] || m[2] || "").trim();
    if (!ref) continue;
    if (ref.startsWith("http://") || ref.startsWith("https://")) continue;
    if (ref.endsWith(".md")) continue;
    const clean = ref.split("#")[0].split("|")[0].trim();
    if (EXCLUDED_ATTACHMENT_EXT.has(extName(clean))) continue;
    found.add(clean);
  }
  return [...found];
}

async function copyTree(srcDir, destDir) {
  let count = 0;
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    return 0; // no static dir; nothing to copy
  }
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await mkdir(dest, { recursive: true });
      count += await copyTree(src, dest);
    } else {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, await readFile(src));
      count += 1;
    }
  }
  return count;
}

export async function syncVault({ vaultDir, contentDir, staticDir }) {
  try {
    const s = await stat(vaultDir);
    if (!s.isDirectory()) throw new Error("not a directory");
    // stat() can succeed on an iCloud dir we still can't read; probe readability.
    await readdir(vaultDir);
  } catch {
    throw new Error(
      `Vault path not found or unreadable: ${vaultDir}\n` +
        "If the path exists, grant your terminal Full Disk Access in " +
        "System Settings > Privacy & Security > Full Disk Access, then retry.\n" +
        "(System Settings > Privacy & Security > Full Disk Access > enable your " +
        "terminal app, e.g. Terminal or iTerm, then fully quit and reopen it.)",
    );
  }

  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });

  // Copy durable static pages (e.g. index.md) that survive every sync.
  let staticFiles = 0;
  if (staticDir) {
    staticFiles = await copyTree(staticDir, contentDir);
  }

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

  return { synced, skipped, assets, staticFiles };
}

// Run as CLI: `npm run sync`
if (import.meta.url === `file://${process.argv[1]}`) {
  syncVault({
    vaultDir: DEFAULT_VAULT_DIR,
    contentDir: DEFAULT_CONTENT_DIR,
    staticDir: DEFAULT_STATIC_DIR,
  })
    .then(({ synced, skipped, assets, staticFiles }) => {
      console.log(
        `Synced ${synced} notes, ${assets} attachments, ` +
          `${staticFiles} static pages. Skipped ${skipped} unpublished.`,
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
