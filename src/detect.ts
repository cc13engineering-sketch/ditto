import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Detection {
  cliJs: string;
  packageJson: string;
  version: string;
}

export function detectClaudeCode(): Detection {
  let npmRoot: string;
  try {
    npmRoot = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    throw new Error(`npm root -g failed — is npm installed and on PATH? (${(err as Error).message})`);
  }

  const pkgDir = path.join(npmRoot, "@anthropic-ai", "claude-code");
  const cliJs = path.join(pkgDir, "cli.js");
  const packageJson = path.join(pkgDir, "package.json");

  if (!existsSync(cliJs)) {
    throw new Error(
      `Claude Code cli.js not found at ${cliJs}\n` +
        `Install with: npm install -g @anthropic-ai/claude-code`,
    );
  }
  if (!existsSync(packageJson)) {
    throw new Error(`Claude Code package.json missing at ${packageJson}`);
  }

  const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as { version?: string };
  const version = pkg.version;
  if (!version) {
    throw new Error(`Could not read version from ${packageJson}`);
  }

  return { cliJs, packageJson, version };
}
