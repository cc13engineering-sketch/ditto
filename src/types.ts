export interface TweakccPrompt {
  name: string;
  id: string;
  description: string;
  pieces: string[];
  identifiers?: number[];
  identifierMap?: Record<string, string>;
  version?: string;
}

export interface TweakccPromptSet {
  version: string;
  prompts: TweakccPrompt[];
}

export interface VariantModification {
  promptId: string;
  promptName: string;
  pieceIndex: number;
  originalText: string;
  newText: string;
  rationale: string;
}

export interface VariantSkipped {
  rationale: string;
  originalText: string;
  newText: string;
  reason: string;
}

export interface Variant {
  name: string;
  directive: string;
  created: string;
  claudeCodeVersion: string;
  tweakccVersion: string;
  modifications: VariantModification[];
  skipped?: VariantSkipped[];
}

export interface State {
  appliedVariant: string | null;
  lastBackupPath: string | null;
  appliedAt: string | null;
  claudeCodeVersion: string | null;
}
