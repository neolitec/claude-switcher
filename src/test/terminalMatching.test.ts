import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isClaudeInvocation, terminalMatchesWorktree, terminalNameFor } from '../terminalMatching';

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

test('isClaudeInvocation: matches the bare command', () => {
  assert.equal(isClaudeInvocation('claude'), true);
});

test('isClaudeInvocation: matches with arguments', () => {
  assert.equal(isClaudeInvocation('claude --resume abc-123'), true);
});

test('isClaudeInvocation: ignores leading/trailing whitespace', () => {
  assert.equal(isClaudeInvocation('  claude --resume abc-123  '), true);
});

test('isClaudeInvocation: rejects other commands', () => {
  assert.equal(isClaudeInvocation('git status'), false);
  assert.equal(isClaudeInvocation('claudesomethingelse'), false);
  assert.equal(isClaudeInvocation('npx claude'), false);
});
