import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminalMatchesWorktree, terminalNameFor, worktreePathForTerminal } from '../terminalMatching';

test('terminalNameFor: deterministic name from the worktree basename', () => {
  assert.equal(terminalNameFor('/Users/me/dev/repo'), 'Claude · repo');
  assert.equal(terminalNameFor('/Users/me/dev/repo/.claude/worktrees/feat'), 'Claude · feat');
});

test('terminalMatchesWorktree: matches on the env tag', () => {
  assert.equal(terminalMatchesWorktree({ envWorktreePath: '/repo' }, '/repo'), true);
  assert.equal(terminalMatchesWorktree({ envWorktreePath: '/repo/' }, '/repo'), true); // path-normalised
  assert.equal(terminalMatchesWorktree({ envWorktreePath: '/other' }, '/repo'), false);
});

test('terminalMatchesWorktree: matches on shell-integration cwd when env is gone', () => {
  assert.equal(terminalMatchesWorktree({ shellCwdFsPath: '/repo' }, '/repo'), true);
  assert.equal(terminalMatchesWorktree({ shellCwdFsPath: '/elsewhere' }, '/repo'), false);
});

test('terminalMatchesWorktree: falls back to the deterministic name', () => {
  assert.equal(terminalMatchesWorktree({ name: 'Claude · repo' }, '/x/y/repo'), true);
  assert.equal(terminalMatchesWorktree({ name: 'something else' }, '/x/y/repo'), false);
});

test('terminalMatchesWorktree: no signals means no match', () => {
  assert.equal(terminalMatchesWorktree({}, '/repo'), false);
});

test('worktreePathForTerminal: prefers env, then shell cwd, else undefined', () => {
  assert.equal(worktreePathForTerminal({ envWorktreePath: '/a', shellCwdFsPath: '/b' }), '/a');
  assert.equal(worktreePathForTerminal({ shellCwdFsPath: '/b' }), '/b');
  assert.equal(worktreePathForTerminal({ name: 'Claude · repo' }), undefined);
});
