// The converter subagents load the same structure skill as the advisor. A declared subagent
// inherits nothing from its parent, so each one re-declares the skill from the advisor's files
// (skills/vercel-agent-structure/). The text exists once; this module reads it at build time.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineSkill } from "eve/skills";

const SKILL = "skills/vercel-agent-structure";

// eve evaluates this module from a build cache, so the files are found from the working
// directory: the workspace root, the agent's own directory, or the web app during `next build`.
function skillDirectory(): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    for (const candidate of [join(dir, "agents/migration/agent", SKILL), join(dir, "agent", SKILL)]) {
      if (existsSync(join(candidate, "SKILL.md"))) return candidate;
    }
    if (dirname(dir) === dir) throw new Error(`Cannot find agents/migration/agent/${SKILL} from ${process.cwd()}`);
  }
}

const read = (file: string) => readFileSync(join(skillDirectory(), file), "utf8");

export function structureSkill() {
  const [, frontmatter = "", content = ""] = read("SKILL.md").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  return defineSkill({
    description: frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? "Vercel's documented agent structure for this repository.",
    content,
    files: {
      "references/eve.md": read("references/eve.md"),
      "references/workflow-agent.md": read("references/workflow-agent.md"),
      "references/toolloop.md": read("references/toolloop.md"),
    },
  });
}
