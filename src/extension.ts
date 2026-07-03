import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeSessionItem, readSessionTranscript } from './claudeSessionService';
import {
  commandWorktree,
  ProjectFolderNode,
  SessionNode,
  SessionsTreeProvider,
  TreeNode,
  WorktreeNode,
} from './sessionsTreeProvider';
import { createWorktreeTerminal, findActiveTerminal } from './terminalRegistry';
import { watchSessions } from './sessionWatcher';
import { DoubleClickDetector } from './doubleClick';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const provider = new SessionsTreeProvider();
  const treeView = vscode.window.createTreeView('claudeSwitcher.sessions', {
    treeDataProvider: provider,
  });
  const doubleClick = new DoubleClickDetector();

  // Session history toggle (view header). Persisted across reloads; the context
  // key drives which of the show/hide buttons is visible.
  const HISTORY_KEY = 'claudeSwitcher.showHistory';
  const applyHistory = (visible: boolean) => {
    provider.setShowHistory(visible);
    context.globalState.update(HISTORY_KEY, visible);
    vscode.commands.executeCommand('setContext', 'claudeSwitcher.historyVisible', visible);
  };
  applyHistory(context.globalState.get(HISTORY_KEY, false));

  context.subscriptions.push(
    treeView,
    { dispose: () => provider.dispose() },
    vscode.commands.registerCommand('claudeSwitcher.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('claudeSwitcher.showHistory', () => applyHistory(true)),
    vscode.commands.registerCommand('claudeSwitcher.hideHistory', () => applyHistory(false)),
    vscode.commands.registerCommand('claudeSwitcher.previewSession', (arg: SessionNode | ClaudeSessionItem) =>
      previewSession(isSessionNode(arg) ? arg.session : arg)
    ),
    vscode.commands.registerCommand('claudeSwitcher.activateSession', (node: SessionNode) =>
      activateSession(node.session, node.worktreePath)
    ),
    vscode.commands.registerCommand(
      'claudeSwitcher.activateWorktreeLatest',
      (node: WorktreeNode | ProjectFolderNode) => {
        const { path: worktreePath, latestSession } = commandWorktree(node);
        if (latestSession) {
          return activateSession(latestSession, worktreePath);
        }
      }
    ),
    vscode.commands.registerCommand('claudeSwitcher.createSession', (node: WorktreeNode | ProjectFolderNode) =>
      createSession(commandWorktree(node).path)
    ),
    vscode.commands.registerCommand('claudeSwitcher.revealWorktreeTerminal', (node: WorktreeNode | ProjectFolderNode) =>
      findActiveTerminal(commandWorktree(node).path)?.show()
    ),
    // Worktrees with no session don't get a single-click command (see
    // sessionsTreeProvider) — creating a session is consequential enough
    // (spawns a process) to require a deliberate double-click instead.
    treeView.onDidChangeSelection((event) => {
      const node = event.selection[0];
      if (isEmptyWorktreeNode(node) && doubleClick.register(node.worktree.path)) {
        createSession(node.worktree.path);
      }
    }),
    // Adding a worktree folder here never changes which sessions/worktrees exist,
    // so a cheap re-render is enough — no need to re-scan ~/.claude/projects or re-run git.
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.rerender()),
    // Picks up sessions created/updated/removed by the `claude` CLI itself —
    // e.g. the new session created by `createSession` a few seconds after the
    // terminal opens, or activity from a session resumed in another window.
    // A plain content change to an already-known file is patched in place
    // (updateSession) instead of a full refresh() — see its doc comment for
    // why that gap matters for the busy indicator.
    watchSessions((event) =>
      event.structural ? provider.refresh() : Promise.all(event.changedPaths.map((p) => provider.updateSession(p)))
    )
  );

  await provider.refresh();
}

export function deactivate(): void {
  // Terminals are owned by VS Code; nothing to dispose beyond context.subscriptions.
}

function isSessionNode(value: unknown): value is SessionNode {
  return !!value && (value as SessionNode).kind === 'session';
}

function isEmptyWorktreeNode(node: TreeNode | undefined): node is WorktreeNode {
  return !!node && node.kind === 'worktree' && node.worktree.sessions.length === 0;
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

/** Only one Claude Code terminal is tracked per worktree, so activating any
 *  session there just reveals it if one is already running. */
async function activateSession(session: ClaudeSessionItem, worktreePath: string): Promise<void> {
  const existing = findActiveTerminal(worktreePath);
  if (existing) {
    existing.show();
    await ensureWorkspaceFolder(worktreePath);
    return;
  }

  const terminal = createWorktreeTerminal(worktreePath);
  terminal.show();
  terminal.sendText(`claude --resume ${session.id}`);
  await ensureWorkspaceFolder(worktreePath);
}

/** The "+" action: always spawn a fresh `claude` for the worktree, even if one
 *  is already running there (that's an explicit "new session" request — resuming
 *  an existing terminal is what ▶ / clicking a session does). */
async function createSession(worktreePath: string): Promise<void> {
  const terminal = createWorktreeTerminal(worktreePath);
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
