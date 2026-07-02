/**
 * The colour a worktree's icon gets in the tree. Pure and `vscode`-free so the
 * rules are unit-tested; the provider maps these to `ThemeColor`s.
 *
 *  - `green`: a live `claude` terminal is running for the worktree.
 *  - `blue`:  a project root (main worktree) with no terminal open — the
 *    common "here's a project you can jump into" state.
 *  - `grey`:  an empty worktree (e.g. a freshly created `.claude/worktrees/`
 *    one) with nothing in it and nothing running.
 *  - `none`:  a non-root worktree that has sessions but no live terminal.
 */
export type WorktreeColor = 'green' | 'blue' | 'grey' | 'none';

export interface WorktreeColorInput {
  hasActiveTerminal: boolean;
  isMain: boolean;
  hasSessions: boolean;
}

export function worktreeColor({ hasActiveTerminal, isMain, hasSessions }: WorktreeColorInput): WorktreeColor {
  if (hasActiveTerminal) {
    return 'green';
  }
  if (isMain) {
    return 'blue';
  }
  if (!hasSessions) {
    return 'grey';
  }
  return 'none';
}
