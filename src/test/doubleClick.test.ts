import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoubleClickDetector } from '../doubleClick';

test('DoubleClickDetector: two quick selects of the same key is a double-click', () => {
  let now = 1000;
  const detector = new DoubleClickDetector(500, () => now);

  assert.equal(detector.register('a'), false); // first click
  now = 1200;
  assert.equal(detector.register('a'), true); // within window
});

test('DoubleClickDetector: a slow second select is not a double-click', () => {
  let now = 1000;
  const detector = new DoubleClickDetector(500, () => now);

  assert.equal(detector.register('a'), false);
  now = 1600; // 600ms later, outside the window
  assert.equal(detector.register('a'), false);
});

test('DoubleClickDetector: selecting a different key resets', () => {
  let now = 1000;
  const detector = new DoubleClickDetector(500, () => now);

  assert.equal(detector.register('a'), false);
  now = 1100;
  assert.equal(detector.register('b'), false); // different key, not a double
  now = 1200;
  assert.equal(detector.register('b'), true); // now b twice
});

test('DoubleClickDetector: resets after a match so a third click does not chain', () => {
  let now = 1000;
  const detector = new DoubleClickDetector(500, () => now);

  detector.register('a');
  now = 1100;
  assert.equal(detector.register('a'), true); // double
  now = 1200;
  assert.equal(detector.register('a'), false); // third click starts fresh
});
