import * as vscode from 'vscode';
import { isClaudeInvocation } from './terminalMatching';

const exitedTerminals = new WeakSet<vscode.Terminal>();

/**
 * Whether the `claude` process launched in `terminal` has already exited —
 * true after a natural exit, a crash, or Ctrl-C — even though the terminal
 * (shell) itself may still be open and reporting `exitStatus === undefined`.
 * `findActiveTerminal` needs this because a live shell alone doesn't mean a
 * live `claude` session.
 */
export function hasClaudeExited(terminal: vscode.Terminal): boolean {
  return exitedTerminals.has(terminal);
}

/**
 * Tracks the `claude` shell command's lifecycle (not the terminal's) via VS
 * Code's shell integration, so a terminal returned to a bare shell prompt
 * (process exited, shell alive) can be told apart from one still running
 * `claude`. Requires shell integration to be active in the terminal; when it
 * isn't, `hasClaudeExited` simply never flips true and callers fall back to
 * the terminal-liveness check alone — same as before this tracker existed.
 */
export function watchClaudeProcesses(onChange: () => void): vscode.Disposable {
  const startSub = vscode.window.onDidStartTerminalShellExecution((e) => {
    if (isClaudeInvocation(e.execution.commandLine.value)) {
      exitedTerminals.delete(e.terminal);
      onChange();
    }
  });
  const endSub = vscode.window.onDidEndTerminalShellExecution((e) => {
    if (isClaudeInvocation(e.execution.commandLine.value)) {
      exitedTerminals.add(e.terminal);
      onChange();
    }
  });
  return new vscode.Disposable(() => {
    startSub.dispose();
    endSub.dispose();
  });
}
