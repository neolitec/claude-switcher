import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

export interface ClaudeSessionItem {
  id: string;
  title: string;
  filePath: string;
  cwd?: string;
  gitBranch?: string;
  createdAt?: Date;
  updatedAt: Date;
}

export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/** All sessions across every project dir, ungrouped. Defaults to ~/.claude/projects, overridable for tests. */
export async function listAllSessions(projectsDir: string = getClaudeProjectsDir()): Promise<ClaudeSessionItem[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const perDir = await Promise.all(
    entries.filter((e) => e.isDirectory()).map((e) => listSessionsInDir(path.join(projectsDir, e.name)))
  );
  return perDir.flat();
}

async function listSessionsInDir(dirPath: string): Promise<ClaudeSessionItem[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const parsed = await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
      .map((e) => parseSessionFile(path.join(dirPath, e.name)).catch(() => null))
  );
  return parsed.filter((s): s is ClaudeSessionItem => s !== null);
}

/**
 * Reads `filePath` line by line. A plain `fs.createReadStream` piped into
 * `readline` does not forward the stream's `error` event anywhere `for await`
 * can see it — an I/O error (e.g. the file is deleted mid-read) would otherwise
 * surface as an unhandled 'error' event and crash the extension host instead of
 * rejecting this promise.
 */
async function* readLines(filePath: string): AsyncGenerator<string> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  let streamError: Error | undefined;
  stream.on('error', (err) => {
    streamError = err instanceof Error ? err : new Error(String(err));
  });

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (streamError) {
        throw streamError;
      }
      yield line;
    }
    if (streamError) {
      throw streamError;
    }
  } finally {
    rl.close();
  }
}

/** Exported for unit testing; not part of the extension's public surface otherwise. */
export async function parseSessionFile(filePath: string): Promise<ClaudeSessionItem | null> {
  const stat = await fs.promises.stat(filePath);
  const id = path.basename(filePath, '.jsonl');

  let aiTitle: string | undefined;
  let firstUserText: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let createdAt: Date | undefined;

  for await (const line of readLines(filePath)) {
    if (!line) {
      continue;
    }
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (!createdAt && typeof obj.timestamp === 'string') {
      createdAt = new Date(obj.timestamp);
    }
    if (!cwd && typeof obj.cwd === 'string') {
      cwd = obj.cwd;
    }
    if (!gitBranch && typeof obj.gitBranch === 'string') {
      gitBranch = obj.gitBranch;
    }
    if (obj.type === 'ai-title' && typeof obj.aiTitle === 'string') {
      aiTitle = obj.aiTitle;
    }
    if (!firstUserText && obj.type === 'user' && typeof obj.message?.content === 'string') {
      firstUserText = obj.message.content;
    }
  }

  if (!createdAt) {
    return null;
  }

  const title = aiTitle ?? summarize(firstUserText) ?? id;

  return {
    id,
    title,
    filePath,
    cwd,
    gitBranch,
    createdAt,
    updatedAt: stat.mtime,
  };
}

export async function readSessionTranscript(filePath: string): Promise<string> {
  const parts: string[] = [];
  for await (const line of readLines(filePath)) {
    if (!line) {
      continue;
    }
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type !== 'user' && obj.type !== 'assistant') {
      continue;
    }
    const text = extractText(obj.message?.content);
    if (!text) {
      continue;
    }
    const heading = obj.type === 'user' ? '### User' : '### Assistant';
    parts.push(`${heading}\n\n${text}`);
  }

  return parts.join('\n\n---\n\n');
}

function extractText(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const texts = content
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string);
    return texts.length > 0 ? texts.join('\n') : undefined;
  }
  return undefined;
}

function summarize(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (!oneLine) {
    return undefined;
  }
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}
