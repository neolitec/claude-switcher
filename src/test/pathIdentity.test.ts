import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isSameOrInside, resolveRealPath } from '../pathIdentity';

test('resolveRealPath: resolves a symlink to the same canonical path as its target', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switcher-test-'));
  const real = path.join(dir, 'real');
  const link = path.join(dir, 'link');
  fs.mkdirSync(real);
  fs.symlinkSync(real, link);

  assert.equal(resolveRealPath(link), resolveRealPath(real));
});

test('resolveRealPath: falls back to path.resolve when the path does not exist', () => {
  assert.equal(resolveRealPath('does/not/exist'), path.resolve('does/not/exist'));
});

test('isSameOrInside: equal path, descendant, non-descendant, and sibling-with-common-prefix', () => {
  assert.equal(isSameOrInside('/a/b', '/a/b'), true);
  assert.equal(isSameOrInside('/a/b/c/d', '/a/b'), true);
  assert.equal(isSameOrInside('/a', '/a/b'), false);
  assert.equal(isSameOrInside('/a/bc', '/a/b'), false);
});
