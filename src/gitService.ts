import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch?: string;
  detached: boolean;
  isMain: boolean;
}

/**
 * Lists all worktrees of the git repo that `repoPath` belongs to.
 * Works whether `repoPath` is the main worktree or a linked one.
 * Returns [] if `repoPath` is not inside a git repo.
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoPath,
    }));
  } catch {
    return [];
  }

  return parseWorktreeListPorcelain(stdout);
}

/** Pure parser for `git worktree list --porcelain` output, split out for unit testing. */
export function parseWorktreeListPorcelain(stdout: string): WorktreeInfo[] {
  const blocks = stdout.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const worktrees: WorktreeInfo[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    let path: string | undefined;
    let branch: string | undefined;
    let detached = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length).trim();
      } else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length).trim();
        branch = ref.replace(/^refs\/heads\//, '');
      } else if (line === 'detached') {
        detached = true;
      }
    }

    if (path) {
      worktrees.push({ path, branch, detached, isMain: index === 0 });
    }
  });

  return worktrees;
}
