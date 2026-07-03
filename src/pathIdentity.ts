import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves `p` to its canonical on-disk form (symlinks followed, case
 * normalized on case-insensitive filesystems) so paths coming from different
 * sources (git, session files) can be compared for identity. Falls back to a
 * plain `path.resolve` when the path doesn't exist yet or can't be read.
 */
export function resolveRealPath(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}
