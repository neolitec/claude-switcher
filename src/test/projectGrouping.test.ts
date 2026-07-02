import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectLayout, isUnderClaudeWorktrees, RepoWorktrees } from '../projectGrouping';
import { WorktreeInfo } from '../gitService';

function wt(path: string, isMain = false, branch?: string): WorktreeInfo {
  return { path, isMain, detached: false, branch };
}

test('isUnderClaudeWorktrees: matches worktrees inside <root>/.claude/worktrees', () => {
  assert.equal(isUnderClaudeWorktrees('/repo', '/repo/.claude/worktrees/feature-x'), true);
});

test('isUnderClaudeWorktrees: rejects sibling worktrees outside the repo', () => {
  assert.equal(isUnderClaudeWorktrees('/repo', '/repo-feature-x'), false);
});

test('isUnderClaudeWorktrees: rejects the .claude/worktrees dir itself (no child)', () => {
  assert.equal(isUnderClaudeWorktrees('/repo', '/repo/.claude/worktrees'), false);
});

test('buildProjectLayout: nests only .claude/worktrees children under the repo', () => {
  const repos: RepoWorktrees[] = [
    {
      root: '/repo',
      worktrees: [wt('/repo', true, 'main'), wt('/repo/.claude/worktrees/managed', false, 'managed')],
    },
  ];

  const layout = buildProjectLayout(repos, [], new Set());

  assert.equal(layout.length, 1);
  assert.equal(layout[0].rootPath, '/repo');
  assert.deepEqual(
    layout[0].worktrees.map((w) => w.path),
    ['/repo', '/repo/.claude/worktrees/managed']
  );
});

test('buildProjectLayout: promotes an external sibling worktree only when it has sessions', () => {
  const repos: RepoWorktrees[] = [
    {
      root: '/repo',
      worktrees: [wt('/repo', true, 'main'), wt('/repo-feature', false, 'feature')],
    },
  ];

  const layout = buildProjectLayout(repos, [], new Set(['/repo-feature']));

  assert.equal(layout.length, 2);
  const external = layout.find((p) => p.rootPath === '/repo-feature');
  assert.ok(external);
  assert.equal(external.worktrees.length, 1);
  // Promoted to the root of its own project so it gets create/resume affordances.
  assert.equal(external.worktrees[0].isMain, true);
  assert.equal(external.worktrees[0].branch, 'feature');
});

test('buildProjectLayout: ignores an external sibling worktree with no sessions', () => {
  const repos: RepoWorktrees[] = [
    {
      root: '/repo',
      worktrees: [wt('/repo', true, 'main'), wt('/repo-feature', false, 'feature')],
    },
  ];

  const layout = buildProjectLayout(repos, [], new Set());

  assert.equal(layout.length, 1);
  assert.equal(layout[0].rootPath, '/repo');
  assert.deepEqual(
    layout[0].worktrees.map((w) => w.path),
    ['/repo']
  );
});

test('buildProjectLayout: shows managed worktrees even without sessions, promotes external only with sessions', () => {
  const repos: RepoWorktrees[] = [
    {
      root: '/repo',
      worktrees: [wt('/repo', true, 'main'), wt('/repo/.claude/worktrees/a', false, 'a'), wt('/repo-b', false, 'b')],
    },
  ];

  // Only /repo-b has sessions; the managed worktree /repo/.claude/worktrees/a does not.
  const layout = buildProjectLayout(repos, [], new Set(['/repo-b']));

  const repoProject = layout.find((p) => p.rootPath === '/repo');
  assert.deepEqual(
    repoProject?.worktrees.map((w) => w.path),
    ['/repo', '/repo/.claude/worktrees/a']
  );
  assert.ok(layout.find((p) => p.rootPath === '/repo-b'));
  assert.equal(layout.length, 2);
});

test('buildProjectLayout: standalone cwds become single-worktree projects', () => {
  const layout = buildProjectLayout([], ['/Users/me/not-a-git-repo'], new Set());

  assert.equal(layout.length, 1);
  assert.equal(layout[0].rootPath, '/Users/me/not-a-git-repo');
  assert.equal(layout[0].worktrees[0].isMain, true);
});

test('buildProjectLayout: falls back to the first worktree when none is flagged main', () => {
  const repos: RepoWorktrees[] = [
    { root: '/repo', worktrees: [wt('/repo', false, 'main'), wt('/repo/.claude/worktrees/a', false, 'a')] },
  ];

  const layout = buildProjectLayout(repos, [], new Set());

  assert.equal(layout.length, 1);
  assert.deepEqual(
    layout[0].worktrees.map((w) => w.path),
    ['/repo', '/repo/.claude/worktrees/a']
  );
});

test('buildProjectLayout: skips a repo with no worktrees at all', () => {
  const layout = buildProjectLayout([{ root: '/repo', worktrees: [] }], [], new Set());
  assert.deepEqual(layout, []);
});
