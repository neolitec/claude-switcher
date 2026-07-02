import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const DEBOUNCE_MS = 300;

/**
 * Watches each repo's `.git/worktrees` metadata directory so the tree updates
 * when a worktree is added or removed — whether by the user's `git worktree add`
 * or by Claude Code itself.
 *
 * This is deliberately independent of the session `.jsonl` watcher: creating a
 * worktree writes no session file, and Claude Code persists sessions lazily, so
 * watching `~/.claude/projects` alone never catches a worktree appearing.
 */
export class WorktreeWatcher {
  private watchers: vscode.FileSystemWatcher[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly onChange: () => void) {}

  /** (Re)establish watchers for the given repo root paths. Cheap to call on every refresh. */
  setRepoRoots(rootPaths: string[]): void {
    this.disposeWatchers();
    for (const root of rootPaths) {
      const worktreesDir = path.join(root, '.git', 'worktrees');
      // A repo with no linked worktree yet has no `.git/worktrees` dir; its first
      // worktree will be picked up on the next refresh from another trigger.
      if (!fs.existsSync(worktreesDir)) {
        continue;
      }
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(worktreesDir), '*')
      );
      watcher.onDidCreate(() => this.debounced());
      watcher.onDidDelete(() => this.debounced());
      this.watchers.push(watcher);
    }
  }

  private debounced(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(this.onChange, DEBOUNCE_MS);
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.disposeWatchers();
  }
}
