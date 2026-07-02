import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { listWorktrees } from '../gitService';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

test('listWorktrees: reports the main and linked worktrees of a real repo', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-git-'));
  const repo = path.join(base, 'repo');
  fs.mkdirSync(repo);
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, env: GIT_ENV });

  git(['init', '-q', '-b', 'main']);
  fs.writeFileSync(path.join(repo, 'file.txt'), 'x');
  git(['add', '.']);
  git(['commit', '-qm', 'init']);
  git(['worktree', 'add', '-q', '-b', 'feature', path.join(base, 'wt-feature')]);

  const worktrees = await listWorktrees(repo);

  assert.equal(worktrees.length, 2);
  assert.equal(worktrees[0].isMain, true);
  assert.equal(worktrees[0].branch, 'main');
  const feature = worktrees.find((w) => w.branch === 'feature');
  assert.ok(feature);
  assert.equal(feature.isMain, false);
});

test('listWorktrees: returns [] for a directory that is not a git repo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-nogit-'));
  assert.deepEqual(await listWorktrees(dir), []);
});
