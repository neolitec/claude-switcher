import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { listAllSessions, parseSessionFile, readSessionTranscript } from '../claudeSessionService';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'claude-switcher-test-'));
}

function jsonl(...lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

test('parseSessionFile: uses the ai-title when present', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-1.jsonl');
  await fs.writeFile(
    filePath,
    jsonl(
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:00.000Z',
        cwd: '/repo',
        gitBranch: 'main',
        message: { content: 'hello there' },
      },
      { type: 'ai-title', aiTitle: 'A nice descriptive title' }
    )
  );

  const session = await parseSessionFile(filePath);

  assert.ok(session);
  assert.equal(session.title, 'A nice descriptive title');
  assert.equal(session.id, 'session-1');
  assert.equal(session.cwd, '/repo');
  assert.equal(session.gitBranch, 'main');
});

test('parseSessionFile: keeps the last ai-title when several appear', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-2.jsonl');
  await fs.writeFile(
    filePath,
    jsonl(
      { type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { content: 'hi' } },
      { type: 'ai-title', aiTitle: 'First guess' },
      { type: 'ai-title', aiTitle: 'Refined title' }
    )
  );

  const session = await parseSessionFile(filePath);

  assert.equal(session?.title, 'Refined title');
});

test('parseSessionFile: falls back to a summary of the first user message without an ai-title', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-3.jsonl');
  const longMessage = 'a'.repeat(120);
  await fs.writeFile(
    filePath,
    jsonl({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { content: longMessage } })
  );

  const session = await parseSessionFile(filePath);

  assert.ok(session);
  assert.equal(session.title, `${'a'.repeat(80)}…`);
});

test('parseSessionFile: falls back to the session id when there is no title material at all', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-4.jsonl');
  await fs.writeFile(filePath, jsonl({ type: 'system', timestamp: '2026-01-01T00:00:00.000Z' }));

  const session = await parseSessionFile(filePath);

  assert.equal(session?.title, 'session-4');
});

test('parseSessionFile: returns null when the file has no timestamped line', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-5.jsonl');
  await fs.writeFile(filePath, jsonl({ type: 'mode', mode: 'normal' }));

  const session = await parseSessionFile(filePath);

  assert.equal(session, null);
});

test('parseSessionFile: skips malformed JSON lines instead of failing', async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, 'session-6.jsonl');
  await fs.writeFile(
    filePath,
    'not json\n' + jsonl({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { content: 'ok' } })
  );

  const session = await parseSessionFile(filePath);

  assert.ok(session);
  assert.equal(session.title, 'ok');
});

test('parseSessionFile: rejects instead of crashing the process when the stream errors mid-read', async () => {
  const dir = await makeTempDir();
  // Opening a directory as a read stream fails asynchronously with EISDIR once
  // reading starts (stat() above succeeds fine, since the path does exist) —
  // this is what would previously surface as an unhandled 'error' event.
  const unreadablePath = path.join(dir, 'not-actually-a-file.jsonl');
  await fs.mkdir(unreadablePath);

  await assert.rejects(() => parseSessionFile(unreadablePath));
});

test('readSessionTranscript: rejects instead of crashing the process when the stream errors mid-read', async () => {
  const dir = await makeTempDir();
  const unreadablePath = path.join(dir, 'not-actually-a-file.jsonl');
  await fs.mkdir(unreadablePath);

  await assert.rejects(() => readSessionTranscript(unreadablePath));
});

test('listAllSessions: flattens sessions across every project subdirectory', async () => {
  const projectsDir = await makeTempDir();
  const dirA = path.join(projectsDir, '-Users-me-repo-a');
  const dirB = path.join(projectsDir, '-Users-me-repo-b');
  await fs.mkdir(dirA);
  await fs.mkdir(dirB);
  await fs.writeFile(
    path.join(dirA, 'session-a1.jsonl'),
    jsonl({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', cwd: '/repo-a', message: { content: 'a1' } })
  );
  await fs.writeFile(
    path.join(dirB, 'session-b1.jsonl'),
    jsonl({ type: 'user', timestamp: '2026-01-02T00:00:00.000Z', cwd: '/repo-b', message: { content: 'b1' } })
  );
  // A non-.jsonl file should be ignored rather than crashing the scan.
  await fs.writeFile(path.join(dirB, 'notes.txt'), 'irrelevant');

  const sessions = await listAllSessions(projectsDir);

  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map((s) => s.cwd).sort(), ['/repo-a', '/repo-b']);
});

test('listAllSessions: returns an empty list when the projects dir does not exist', async () => {
  const sessions = await listAllSessions('/nonexistent/path/for/sure');
  assert.deepEqual(sessions, []);
});
