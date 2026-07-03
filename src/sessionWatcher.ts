import * as vscode from 'vscode';
import { getClaudeProjectsDir } from './claudeSessionService';

const DEBOUNCE_MS = 500;

export interface SessionChangeEvent {
  /** Every file touched within this debounce window. */
  changedPaths: string[];
  /**
   * Whether a create or delete happened in this window — the set of
   * projects/worktrees/sessions may have changed shape, so callers should do
   * a full re-scan rather than patching in place. A plain content change to
   * an already-known file doesn't need that.
   */
  structural: boolean;
}

/**
 * Watches ~/.claude/projects for session files being created, written to, or
 * removed, and calls `onChange` (debounced) whenever that happens. Session
 * files are written by the `claude` CLI itself — e.g. a few seconds after
 * `createSession`/`activateSession` open a terminal — so the tree can't just
 * refresh once eagerly right after spawning that terminal; it needs to keep
 * watching for whenever the CLI actually gets around to writing the file.
 */
export function watchSessions(onChange: (event: SessionChangeEvent) => void): vscode.Disposable {
  const pattern = new vscode.RelativePattern(vscode.Uri.file(getClaudeProjectsDir()), '**/*.jsonl');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let changedPaths = new Set<string>();
  let structural = false;

  const scheduleFlush = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const event: SessionChangeEvent = { changedPaths: Array.from(changedPaths), structural };
      changedPaths = new Set();
      structural = false;
      onChange(event);
    }, DEBOUNCE_MS);
  };

  const createSub = watcher.onDidCreate((uri) => {
    changedPaths.add(uri.fsPath);
    structural = true;
    scheduleFlush();
  });
  const changeSub = watcher.onDidChange((uri) => {
    changedPaths.add(uri.fsPath);
    scheduleFlush();
  });
  const deleteSub = watcher.onDidDelete((uri) => {
    changedPaths.add(uri.fsPath);
    structural = true;
    scheduleFlush();
  });

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
