import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeSessionItem, readSessionTranscript } from './claudeSessionService';
import { SessionNode, SessionsTreeProvider, WorktreeNode } from './sessionsTreeProvider';
import { createSessionTerminal, findActiveTerminal } from './terminalRegistry';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const provider = new SessionsTreeProvider();
  const treeView = vscode.window.createTreeView('claudeSwitcher.sessions', {
    treeDataProvider: provider,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('claudeSwitcher.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('claudeSwitcher.previewSession', (arg: SessionNode | ClaudeSessionItem) =>
      previewSession(isSessionNode(arg) ? arg.session : arg)
    ),
    vscode.commands.registerCommand('claudeSwitcher.activateSession', (node: SessionNode) =>
      activateSession(node.session, node.worktreePath)
    ),
    vscode.commands.registerCommand('claudeSwitcher.activateWorktreeLatest', (node: WorktreeNode) => {
      const latest = node.worktree.sessions[0];
      if (latest) {
        return activateSession(latest, node.worktree.path);
      }
    }),
    vscode.commands.registerCommand('claudeSwitcher.createSession', (node: WorktreeNode) =>
      createSession(node.worktree.path)
    ),
    // Adding a worktree folder here never changes which sessions/worktrees exist,
    // so a cheap re-render is enough — no need to re-scan ~/.claude/projects or re-run git.
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.rerender())
  );

  await provider.refresh();
}

export function deactivate(): void {
  // Terminals are owned by VS Code; nothing to dispose beyond context.subscriptions.
}

function isSessionNode(value: unknown): value is SessionNode {
  return !!value && (value as SessionNode).kind === 'session';
}

async function previewSession(session: ClaudeSessionItem): Promise<void> {
  const transcript = await readSessionTranscript(session.filePath);
  const header = `# ${session.title}\n\n${session.cwd ?? ''}`;
  const doc = await vscode.workspace.openTextDocument({
    content: `${header}\n\n${transcript}`,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function activateSession(session: ClaudeSessionItem, worktreePath: string): Promise<void> {
  const existing = findActiveTerminal(session.id);
  if (existing) {
    existing.show();
    await ensureWorkspaceFolder(worktreePath);
    return;
  }

  const terminal = createSessionTerminal(session.id, `claude: ${session.title}`.slice(0, 40), worktreePath);
  terminal.show();
  terminal.sendText(`claude --resume ${session.id}`);
  await ensureWorkspaceFolder(worktreePath);
}

async function createSession(worktreePath: string): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: `claude: ${path.basename(worktreePath)}`.slice(0, 40),
    cwd: worktreePath,
  });
  terminal.show();
  terminal.sendText('claude');
  await ensureWorkspaceFolder(worktreePath);
}

async function ensureWorkspaceFolder(folderPath: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const already = folders.some((f) => path.resolve(f.uri.fsPath) === path.resolve(folderPath));
  if (already) {
    return;
  }
  vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(folderPath) });
}
