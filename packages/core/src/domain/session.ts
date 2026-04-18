export type ToolName =
  | 'claude-code'
  | 'cursor'
  | 'copilot'
  | 'chatgpt'
  | 'windsurf'
  | 'cline'
  | 'continue'
  | 'unknown';

export interface SessionParticipant {
  readonly role: 'user' | 'assistant' | 'tool' | 'system';
  readonly displayName?: string;
}

export interface Session {
  readonly id: string;
  readonly tool: ToolName;
  readonly workspace: string;
  readonly branch: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly participants: readonly SessionParticipant[];
  readonly summary: string;
  readonly filesTouched: readonly string[];
  readonly openQuestions: readonly string[];
  readonly rejectedApproaches: readonly string[];
  readonly rawTranscriptRef: string | null;
}
