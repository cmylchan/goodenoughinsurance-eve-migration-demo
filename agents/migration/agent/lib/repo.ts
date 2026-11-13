// The repository inside the sandbox. Legacy code is read here and never executed: the advisor's
// tools only list, read and diff files.
import type { Path } from "./rubric.ts";
import { checkStructure, type RuleResult } from "./structure.ts";

interface Sandbox {
  run(input: { command: string }): PromiseLike<{ exitCode: number; stdout: string; stderr: string }>;
  readTextFile(input: { path: string }): PromiseLike<unknown>;
}

export const REPO_DIR = "repo";
const BASE_DIR = ".base";

const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** Downloads the repository at `ref` twice: a working copy, and a pristine copy to diff against. */
export async function checkout(sandbox: Sandbox, repo: { owner: string; repo: string; base: string }): Promise<{ legacyAgents: { name: string; about: string }[] }> {
  const url = `https://codeload.github.com/${repo.owner}/${repo.repo}/tar.gz/refs/heads/${repo.base}`;
  const result = await sandbox.run({
    command:
      `set -e; rm -rf ${REPO_DIR} ${BASE_DIR}; mkdir -p ${REPO_DIR} ${BASE_DIR}; ` +
      `curl -fsSL ${sh(url)} -o .repo.tgz; tar xzf .repo.tgz --strip-components=1 -C ${REPO_DIR}; ` +
      `tar xzf .repo.tgz --strip-components=1 -C ${BASE_DIR}; rm .repo.tgz; ` +
      `for d in ${REPO_DIR}/legacy/*/; do n=$(basename "$d"); printf '%s\\t%s\\n' "$n" "$(grep -m1 -v '^#\\|^$\\|^Owner\\|^Written\\|^First' "$d/README.md" 2>/dev/null)"; done`,
  });
  if (result.exitCode !== 0) throw new Error(`could not check out the repository: ${result.stderr.slice(0, 300)}`);
  const legacyAgents = result.stdout
    .split("\n")
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [name, about] = line.split("\t");
      return { name, about: about.trim() };
    });
  return { legacyAgents };
}

/** Repo-relative paths that differ from the pristine copy (added or changed; deletions are not supported). */
export async function changedFiles(sandbox: Sandbox): Promise<string[]> {
  const result = await sandbox.run({
    command: `cd ${REPO_DIR} && find . -type f -not -path './node_modules/*' -not -path './.git/*' | while read -r f; do cmp -s "$f" "../${BASE_DIR}/$f" || echo "\${f#./}"; done`,
  });
  if (result.exitCode !== 0) throw new Error(`could not list changes: ${result.stderr.slice(0, 300)}`);
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean).sort();
}

export async function readFiles(sandbox: Sandbox, paths: readonly string[]): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  for (const path of paths) {
    const read = await sandbox.readTextFile({ path: `${REPO_DIR}/${path}` });
    files.push({ path, content: typeof read === "string" ? read : String((read as { content?: unknown } | null)?.content ?? "") });
  }
  return files;
}

export async function structureOf(sandbox: Sandbox, path: Path, name: string): Promise<{ changed: string[]; results: RuleResult[] }> {
  const changed = await changedFiles(sandbox);
  const contents = Object.fromEntries((await readFiles(sandbox, changed.slice(0, 80))).map((file) => [file.path, file.content]));
  return { changed, results: checkStructure({ path, name, changed, contents }) };
}
