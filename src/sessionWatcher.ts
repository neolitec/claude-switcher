import * as vscode from 'vscode';
import { getClaudeProjectsDir } from './claudeSessionService';

const DEBOUNCE_MS = 500;

/**
 * Watches ~/.claude/projects for session files being created, written to, or
 * removed, and calls `onChange` (debounced) whenever that happens. Session
 * files are written by the `claude` CLI itself — e.g. a few seconds after
 * `createSession`/`activateSession` open a terminal — so the tree can't just
 * refresh once eagerly right after spawning that terminal; it needs to keep
 * watching for whenever the CLI actually gets around to writing the file.
 */
export function watchSessions(onChange: () => void): vscode.Disposable {
  const pattern = new vscode.RelativePattern(vscode.Uri.file(getClaudeProjectsDir()), '**/*.jsonl');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const debouncedChange = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onChange, DEBOUNCE_MS);
  };

  const createSub = watcher.onDidCreate(debouncedChange);
  const changeSub = watcher.onDidChange(debouncedChange);
  const deleteSub = watcher.onDidDelete(debouncedChange);

  return new vscode.Disposable(() => {
    if (timer) {
      clearTimeout(timer);
    }
    createSub.dispose();
    changeSub.dispose();
    deleteSub.dispose();
    watcher.dispose();
  });
}
