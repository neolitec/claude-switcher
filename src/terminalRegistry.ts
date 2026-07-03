import * as vscode from 'vscode';
import { TerminalSignals, WORKTREE_ENV_KEY, terminalMatchesWorktree, terminalNameFor } from './terminalMatching';

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

/**
 * Whether the terminal currently focused in the panel belongs to `worktreePath`.
 * Uses the same signal matching as `findActiveTerminal` so "has a running
 * terminal" and "is the focused terminal" can never disagree about which
 * worktree a given terminal belongs to.
 */
export function isActiveTerminalForWorktree(worktreePath: string): boolean {
  const terminal = vscode.window.activeTerminal;
  if (!terminal || terminal.exitStatus !== undefined) {
    return false;
  }
  return terminalMatchesWorktree(signalsOf(terminal), worktreePath);
}

export function createWorktreeTerminal(worktreePath: string): vscode.Terminal {
  return vscode.window.createTerminal({
    name: terminalNameFor(worktreePath),
    cwd: worktreePath,
    env: { [WORKTREE_ENV_KEY]: worktreePath },
  });
}
