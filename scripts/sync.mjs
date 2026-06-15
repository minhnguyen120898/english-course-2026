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
