import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readdir, chmod } from "node:fs/promises";
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

test("throws a clear error when the vault path is missing", async () => {
  const content = await makeContent();
  await assert.rejects(
    () => syncVault({ vaultDir: "/no/such/vault/path", contentDir: content }),
    /Vault path not found or unreadable/,
  );
  await rm(content, { recursive: true, force: true });
});

test("throws a clear error when the vault exists but is unreadable", async () => {
  const vault = await makeVault();
  const content = await makeContent();
  await chmod(vault, 0o000); // exists + statable, but not readable
  try {
    await assert.rejects(
      () => syncVault({ vaultDir: vault, contentDir: content }),
      /Vault path not found or unreadable/,
    );
  } finally {
    await chmod(vault, 0o700); // restore so cleanup can remove it
    await rm(vault, { recursive: true, force: true });
    await rm(content, { recursive: true, force: true });
  }
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
