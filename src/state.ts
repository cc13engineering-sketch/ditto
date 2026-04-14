import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STATE_FILE } from "./paths";
import type { State } from "./types";

const defaults: State = {
  appliedVariant: null,
  lastBackupPath: null,
  appliedAt: null,
  claudeCodeVersion: null,
};

export function readState(): State {
  if (!existsSync(STATE_FILE)) return { ...defaults };
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<State>;
    return { ...defaults, ...raw };
  } catch {
    return { ...defaults };
  }
}

export function writeState(s: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function clearAppliedInState(): void {
  const s = readState();
  s.appliedVariant = null;
  s.appliedAt = null;
  writeState(s);
}
