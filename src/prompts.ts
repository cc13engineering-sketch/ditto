import type { TweakccPrompt } from "./types";

export interface PromptSummary {
  id: string;
  name: string;
  description: string;
  pieceCount: number;
}

export function summarize(prompts: TweakccPrompt[]): PromptSummary[] {
  return prompts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    pieceCount: p.pieces.length,
  }));
}

export function findPromptById(prompts: TweakccPrompt[], id: string): TweakccPrompt | null {
  return prompts.find((p) => p.id === id) ?? null;
}

export function renderPrompt(prompt: TweakccPrompt): string {
  const { pieces, identifiers = [], identifierMap = {} } = prompt;
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    out += pieces[i] ?? "";
    if (i < pieces.length - 1) {
      const slot = identifiers[i];
      const name =
        slot !== undefined ? identifierMap[String(slot)] ?? `IDENTIFIER_${slot}` : `IDENTIFIER_${i}`;
      out += "${" + name + "}";
    }
  }
  return out;
}

export function renderPromptAnnotated(prompt: TweakccPrompt): string {
  const { pieces, identifiers = [], identifierMap = {} } = prompt;
  const header =
    `# ${prompt.name}\n` +
    `# id: ${prompt.id}\n` +
    `# description: ${prompt.description}\n` +
    `# pieces: ${pieces.length} | identifiers: ${identifiers.length}\n` +
    `# ---- begin reconstructed prompt ----\n`;

  let body = "";
  for (let i = 0; i < pieces.length; i++) {
    body += `\n<!-- piece ${i} -->\n`;
    body += pieces[i] ?? "";
    if (i < pieces.length - 1) {
      const slot = identifiers[i];
      const name =
        slot !== undefined ? identifierMap[String(slot)] ?? `IDENTIFIER_${slot}` : `IDENTIFIER_${i}`;
      body += "${" + name + "}";
    }
  }

  return header + body + "\n# ---- end ----\n";
}
