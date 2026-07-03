import * as path from 'path';

/** Env var we stamp on terminals we open, so we can re-associate them to a worktree. */
export const WORKTREE_ENV_KEY = 'CLAUDE_SWITCHER_WORKTREE_PATH';

/**
 * The signals we can read off a `vscode.Terminal` to tell which worktree it
 * belongs to. Kept as a plain interface (no `vscode` import) so the matching
 * rules can be unit-tested without a VS Code host.
 */
export interface TerminalSignals {
  /** `creationOptions.env[WORKTREE_ENV_KEY]` — lost on a full window reload. */
  envWorktreePath?: string;
  /** `shellIntegration.cwd?.fsPath` — survives a full reload, needs shell integration. */
  shellCwdFsPath?: string;
  /** `terminal.name` — always persisted, but only a basename, so least precise. */
  name?: string;
}

export function terminalNameFor(worktreePath: string): string {
  return `Claude · ${path.basename(worktreePath)}`;
}

/** Whether a terminal (described by its signals) belongs to `worktreePath`. */
export function terminalMatchesWorktree(signals: TerminalSignals, worktreePath: string): boolean {
  const resolved = path.resolve(worktreePath);

  if (signals.envWorktreePath && path.resolve(signals.envWorktreePath) === resolved) {
    return true;
  }
  if (signals.shellCwdFsPath && path.resolve(signals.shellCwdFsPath) === resolved) {
    return true;
  }
  return signals.name === terminalNameFor(worktreePath);
}
