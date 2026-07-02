import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { readSessionTranscript } from '../claudeSessionService';

async function writeJsonl(...lines: object[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cs-transcript-'));
  const filePath = path.join(dir, 'session.jsonl');
  await fs.writeFile(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return filePath;
}

test('readSessionTranscript: renders user and assistant string messages with headings', async () => {
  const file = await writeJsonl(
    { type: 'user', message: { content: 'hello' } },
    { type: 'assistant', message: { content: 'hi there' } }
  );

  const transcript = await readSessionTranscript(file);

  assert.equal(transcript, '### User\n\nhello\n\n---\n\n### Assistant\n\nhi there');
});

test('readSessionTranscript: extracts text blocks from array content', async () => {
  const file = await writeJsonl({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'first' },
        { type: 'tool_use', name: 'x' },
        { type: 'text', text: 'second' },
      ],
    },
  });

  const transcript = await readSessionTranscript(file);

  assert.equal(transcript, '### Assistant\n\nfirst\nsecond');
});

test('readSessionTranscript: skips messages whose content has no text', async () => {
  const file = await writeJsonl(
    { type: 'user', message: { content: 'kept' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'only-tool' }] } }
  );

  const transcript = await readSessionTranscript(file);

  assert.equal(transcript, '### User\n\nkept');
});

test('readSessionTranscript: ignores non user/assistant lines and malformed JSON', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cs-transcript-'));
  const file = path.join(dir, 'session.jsonl');
  await fs.writeFile(
    file,
    [
      JSON.stringify({ type: 'mode', mode: 'normal' }),
      'not valid json',
      JSON.stringify({ type: 'user', message: { content: 'survives' } }),
    ].join('\n') + '\n'
  );

  const transcript = await readSessionTranscript(file);

  assert.equal(transcript, '### User\n\nsurvives');
});

test('readSessionTranscript: empty transcript for a session with no messages', async () => {
  const file = await writeJsonl({ type: 'system', subtype: 'init' });
  assert.equal(await readSessionTranscript(file), '');
});
