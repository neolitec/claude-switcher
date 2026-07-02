import * as vscode from 'vscode';

/**
 * VS Code reloads the whole extension host when a single-folder window is
 * converted to a multi-root workspace (which `ensureWorkspaceFolder` does the
 * first time a session's worktree isn't open yet). Any in-memory state — like
 * a plain `Map<sessionId, Terminal>` — is wiped by that reload even though the
 * terminal itself survives. Tagging the terminal's env instead lets us find it
 * again by scanning `vscode.window.terminals`, which VS Code repopulates.
 */
const SESSION_ENV_KEY = 'CLAUDE_SWITCHER_SESSION_ID';

export function findActiveTerminal(sessionId: string): vscode.Terminal | undefined {
  return vscode.window.terminals.find((terminal) => {
    if (terminal.exitStatus !== undefined) {
      return false;
    }
    const options = terminal.creationOptions as vscode.TerminalOptions | undefined;
    return options?.env?.[SESSION_ENV_KEY] === sessionId;
  });
}

export function createSessionTerminal(sessionId: string, name: string, cwd: string): vscode.Terminal {
  return vscode.window.createTerminal({
    name,
    cwd,
    env: { [SESSION_ENV_KEY]: sessionId },
  });
}
