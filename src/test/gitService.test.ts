import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorktreeListPorcelain } from '../gitService';

test('parseWorktreeListPorcelain: single main worktree on a branch', () => {
  const stdout = ['worktree /repo', 'HEAD abc123', 'branch refs/heads/main', ''].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.deepEqual(worktrees, [{ path: '/repo', branch: 'main', detached: false, isMain: true }]);
});

test('parseWorktreeListPorcelain: main + linked worktree, first block is always main', () => {
  const stdout = [
    'worktree /repo',
    'HEAD abc123',
    'branch refs/heads/main',
    '',
    'worktree /repo-worktrees/feature-x',
    'HEAD def456',
    'branch refs/heads/feature-x',
    '',
  ].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.equal(worktrees.length, 2);
  assert.deepEqual(worktrees[0], { path: '/repo', branch: 'main', detached: false, isMain: true });
  assert.deepEqual(worktrees[1], {
    path: '/repo-worktrees/feature-x',
    branch: 'feature-x',
    detached: false,
    isMain: false,
  });
});

test('parseWorktreeListPorcelain: detached HEAD worktree has no branch', () => {
  const stdout = [
    'worktree /repo',
    'HEAD abc123',
    'branch refs/heads/main',
    '',
    'worktree /repo-detached',
    'HEAD def456',
    'detached',
    '',
  ].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.equal(worktrees.length, 2);
  assert.deepEqual(worktrees[1], { path: '/repo-detached', branch: undefined, detached: true, isMain: false });
});

test('parseWorktreeListPorcelain: a bare repo main entry is marked bare, with no branch', () => {
  const stdout = ['worktree /repo.git', 'bare', ''].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.deepEqual(worktrees, [{ path: '/repo.git', branch: undefined, detached: false, isMain: true, bare: true }]);
});

test('parseWorktreeListPorcelain: a non-bare worktree has no bare field', () => {
  const stdout = ['worktree /repo', 'HEAD abc123', 'branch refs/heads/main', ''].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.equal('bare' in worktrees[0], false);
});

test('parseWorktreeListPorcelain: empty output yields no worktrees', () => {
  assert.deepEqual(parseWorktreeListPorcelain(''), []);
});

test('parseWorktreeListPorcelain: strips refs/heads/ prefix from branch names', () => {
  const stdout = ['worktree /repo', 'HEAD abc123', 'branch refs/heads/feature/nested-name', ''].join('\n');

  const worktrees = parseWorktreeListPorcelain(stdout);

  assert.equal(worktrees[0].branch, 'feature/nested-name');
});
