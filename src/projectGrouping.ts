import * as path from 'path';
import { WorktreeInfo } from './gitService';
import { resolveRealPath } from './pathIdentity';

export interface RepoWorktrees {
  /** Main worktree path of the repo. */
  root: string;
  /** All worktrees of the repo, as reported by `git worktree list`. */
  worktrees: WorktreeInfo[];
}

export interface ProjectLayout {
  rootPath: string;
  worktrees: WorktreeInfo[];
}

/** True when `wtPath` lives under `<root>/.claude/worktrees/`. */
export function isUnderClaudeWorktrees(root: string, wtPath: string): boolean {
  const base = path.resolve(root, '.claude', 'worktrees') + path.sep;
  return path.resolve(wtPath).startsWith(base);
}

/**
 * Turns discovered repos (+ standalone non-git cwds) into the tree's top-level
 * projects.
 *
 * A repo project shows its main worktree plus the linked worktrees that live
 * under its `.claude/worktrees/` — the ones Claude Code manages (shown even when
 * empty). Any other linked worktree (e.g. a hand-made sibling created with
 * `git worktree add`) is only surfaced — as its own top-level project — when it
 * actually has sessions of its own; otherwise it's ignored entirely.
 *
 * `sessionCwds` holds the resolved cwd of every session that exists.
 */
export function buildProjectLayout(
  repos: RepoWorktrees[],
  standaloneCwds: string[],
  sessionCwds: ReadonlySet<string>
): ProjectLayout[] {
  const layout: ProjectLayout[] = [];

  for (const cwd of standaloneCwds) {
    layout.push({ rootPath: cwd, worktrees: [{ path: cwd, detached: false, isMain: true }] });
  }

  for (const { root, worktrees } of repos) {
    const main = worktrees.find((w) => w.isMain) ?? worktrees[0];
    if (!main) {
      continue;
    }
    const linked = worktrees.filter((w) => w !== main);
    const managed = linked.filter((w) => isUnderClaudeWorktrees(root, w.path));
    const external = linked.filter(
      (w) => !isUnderClaudeWorktrees(root, w.path) && sessionCwds.has(resolveRealPath(w.path))
    );

    layout.push({ rootPath: root, worktrees: [main, ...managed] });

    for (const ext of external) {
      // Treated as the root of its own project so it gets the create/resume affordances.
      layout.push({ rootPath: ext.path, worktrees: [{ ...ext, isMain: true }] });
    }
  }

  return layout;
}
