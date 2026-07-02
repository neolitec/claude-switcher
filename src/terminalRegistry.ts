import * as vscode from 'vscode';
import {
  TerminalSignals,
  WORKTREE_ENV_KEY,
  terminalMatchesWorktree,
  terminalNameFor,
  worktreePathForTerminal,
} from './terminalMatching';

/**
 * We track "the Claude Code terminal for this worktree" without any in-memory
 * Map, because VS Code drops extension state on reload. Different reloads drop
 * different things, so `terminalMatching` accepts a terminal on any of several
 * signals; here we just read those signals off the live `vscode.Terminal`.
 * See terminalMatching.ts for the rationale behind each signal.
 */
function signalsOf(terminal: vscode.Terminal): TerminalSignals {
  const options = terminal.creationOptions as vscode.TerminalOptions | undefined;
  const env = options?.env?.[WORKTREE_ENV_KEY];
  return {
    envWorktreePath: typeof env === 'string' ? env : undefined,
    shellCwdFsPath: terminal.shellIntegration?.cwd?.fsPath,
    name: terminal.name,
  };
}

export function findActiveTerminal(worktreePath: string): vscode.Terminal | undefined {
  return vscode.window.terminals.find(
    (terminal) => terminal.exitStatus === undefined && terminalMatchesWorktree(signalsOf(terminal), worktreePath)
  );
}

/** The worktree path of the terminal currently focused in the panel, if any. */
export function activeTerminalWorktreePath(): string | undefined {
  const terminal = vscode.window.activeTerminal;
  if (!terminal || terminal.exitStatus !== undefined) {
    return undefined;
  }
  return worktreePathForTerminal(signalsOf(terminal));
}

export function createWorktreeTerminal(worktreePath: string): vscode.Terminal {
  return vscode.window.createTerminal({
    name: terminalNameFor(worktreePath),
    cwd: worktreePath,
    env: { [WORKTREE_ENV_KEY]: worktreePath },
  });
}
