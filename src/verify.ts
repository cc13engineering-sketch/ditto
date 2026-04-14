import { spawnSync } from "node:child_process";

export interface VerifyResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function verifyCliJs(cliJs: string, nodeBin = "node"): VerifyResult {
  const res = spawnSync(nodeBin, [cliJs, "--version"], {
    encoding: "utf8",
    timeout: 20_000,
  });
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  const ok =
    res.status === 0 &&
    stdout.trim().length > 0 &&
    !/error/i.test(stdout) &&
    !res.error;
  return { ok, stdout, stderr, code: res.status };
}
