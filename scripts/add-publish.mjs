import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import matter from "gray-matter";

// One-shot helper: add `publish: true` to the frontmatter of every .md in the vault.
// - Notes with existing frontmatter: the `publish` key is added/updated, other keys preserved.
// - Notes without frontmatter: a fresh frontmatter block is prepended.
// - Notes that already have `publish: true`: left untouched (reported as skipped).
// Pass --dry to preview without writing.

const VAULT_DIR =
  "/Users/minhnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/English Course";

const DRY_RUN = process.argv.includes("--dry");

async function walkMarkdown(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".obsidian" || entry.name === ".trash") continue;
      await walkMarkdown(full, base, acc);
    } else if (entry.name.endsWith(".md")) {
      acc.push({ full, rel: relative(base, full) });
    }
  }
  return acc;
}

async function run() {
  try {
    const s = await stat(VAULT_DIR);
    if (!s.isDirectory()) throw new Error("not a directory");
    await readdir(VAULT_DIR);
  } catch {
    console.error(
      `Vault path not found or unreadable: ${VAULT_DIR}\n` +
        "Grant your terminal Full Disk Access (System Settings > Privacy & " +
        "Security > Full Disk Access), then fully quit and reopen it.",
    );
    process.exit(1);
  }

  const files = await walkMarkdown(VAULT_DIR);
  let changed = 0;
  let alreadySet = 0;

  for (const { full, rel } of files) {
    const raw = await readFile(full, "utf8");
    let parsed;
    try {
      parsed = matter(raw);
    } catch {
      console.warn(`SKIP (bad frontmatter): ${rel}`);
      continue;
    }

    if (parsed.data && parsed.data.publish === true) {
      alreadySet += 1;
      continue;
    }

    const newData = { ...parsed.data, publish: true };
    const output = matter.stringify(parsed.content, newData);

    if (DRY_RUN) {
      console.log(`WOULD UPDATE: ${rel}`);
    } else {
      await writeFile(full, output);
      console.log(`UPDATED: ${rel}`);
    }
    changed += 1;
  }

  const verb = DRY_RUN ? "Would update" : "Updated";
  console.log(
    `\n${verb} ${changed} notes. ${alreadySet} already had publish: true. ` +
      `${files.length} total.`,
  );
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
