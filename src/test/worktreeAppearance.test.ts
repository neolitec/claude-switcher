import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worktreeColor } from '../worktreeAppearance';

test('worktreeColor: a live terminal wins over everything → green', () => {
  assert.equal(worktreeColor({ hasActiveTerminal: true, isMain: true, hasSessions: true }), 'green');
  assert.equal(worktreeColor({ hasActiveTerminal: true, isMain: false, hasSessions: false }), 'green');
});

test('worktreeColor: a project root with no terminal → blue', () => {
  assert.equal(worktreeColor({ hasActiveTerminal: false, isMain: true, hasSessions: true }), 'blue');
  // Blue even with no sessions: root is still a project you can jump into.
  assert.equal(worktreeColor({ hasActiveTerminal: false, isMain: true, hasSessions: false }), 'blue');
});

test('worktreeColor: an empty non-root worktree → grey', () => {
  assert.equal(worktreeColor({ hasActiveTerminal: false, isMain: false, hasSessions: false }), 'grey');
});

test('worktreeColor: a non-root worktree with sessions but no terminal → none', () => {
  assert.equal(worktreeColor({ hasActiveTerminal: false, isMain: false, hasSessions: true }), 'none');
});
