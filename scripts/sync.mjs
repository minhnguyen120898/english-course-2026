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
