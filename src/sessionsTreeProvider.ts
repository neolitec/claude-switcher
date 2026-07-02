import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeSessionItem, listAllSessions } from './claudeSessionService';
import { listWorktrees, WorktreeInfo } from './gitService';
import { findActiveTerminal } from './terminalRegistry';

interface WorktreeWithSessions extends WorktreeInfo {
  /** Sorted most-recent first. */
  sessions: ClaudeSessionItem[];
}

interface ProjectData {
  /** Path of the main worktree — doubles as a stable identity for the repo. */
  rootPath: string;
  worktrees: WorktreeWithSessions[];
}

export class ProjectFolderNode {
  readonly kind = 'projectFolder';
  constructor(readonly data: ProjectData) {}
}

export class WorktreeNode {
  readonly kind = 'worktree';
  constructor(readonly worktree: WorktreeWithSessions) {}
}

export class SessionNode {
  readonly kind = 'session';
  constructor(
    readonly session: ClaudeSessionItem,
    readonly worktreePath: string
  ) {}
}

export class PreviousSessionsNode {
  readonly kind = 'previousSessions';
  constructor(
    readonly sessions: ClaudeSessionItem[],
    readonly worktreePath: string
  ) {}
}

export type TreeNode = ProjectFolderNode | WorktreeNode | SessionNode | PreviousSessionsNode;

export class SessionsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private projects: ProjectData[] = [];

  constructor() {
    // "Active" highlighting is derived live from vscode.window.terminals (see
    // terminalRegistry) rather than tracked in memory, so a cheap re-render is
    // all that's needed to pick up terminals opening/closing.
    vscode.window.onDidOpenTerminal(() => this.onDidChangeTreeDataEmitter.fire());
    vscode.window.onDidCloseTerminal(() => this.onDidChangeTreeDataEmitter.fire());
  }

  /** Re-renders the tree from already-loaded data, without touching disk or git. */
  rerender(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  async refresh(): Promise<void> {
    const allSessions = await listAllSessions();
    const cwds = Array.from(new Set(allSessions.map((s) => s.cwd).filter((c): c is string => !!c)));

    const perCwdWorktrees = await Promise.all(
      cwds.map(async (cwd) => {
        const worktrees = await listWorktrees(cwd);
        if (worktrees.length === 0) {
          // Not a git repo (or git unavailable) — treat the cwd itself as a standalone "project".
          return { rootPath: cwd, worktrees: [{ path: cwd, detached: false, isMain: true }] };
        }
        return { rootPath: worktrees[0].path, worktrees };
      })
    );

    // rootPath -> worktrees (without sessions yet)
    const worktreesByRoot = new Map<string, WorktreeInfo[]>();
    for (const { rootPath, worktrees } of perCwdWorktrees) {
      if (!worktreesByRoot.has(rootPath)) {
        worktreesByRoot.set(rootPath, worktrees);
      }
    }

    const projects: ProjectData[] = [];
    for (const [rootPath, worktrees] of worktreesByRoot) {
      const worktreesWithSessions: WorktreeWithSessions[] = worktrees.map((wt) => ({
        ...wt,
        sessions: allSessions
          .filter((s) => s.cwd && path.resolve(s.cwd) === path.resolve(wt.path))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      }));
      projects.push({ rootPath, worktrees: worktreesWithSessions });
    }

    projects.sort((a, b) => latestActivity(b) - latestActivity(a));

    this.projects = projects;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === 'projectFolder') {
      return this.buildProjectFolderItem(element.data);
    }
    if (element.kind === 'worktree') {
      return this.buildWorktreeItem(element);
    }
    if (element.kind === 'previousSessions') {
      return this.buildPreviousSessionsItem(element);
    }
    return this.buildSessionItem(element);
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.projects.map((data) => new ProjectFolderNode(data));
    }
    if (element.kind === 'projectFolder') {
      return element.data.worktrees.map((wt) => new WorktreeNode(wt));
    }
    if (element.kind === 'worktree') {
      const [latest, ...older] = element.worktree.sessions;
      if (!latest) {
        return [];
      }
      const children: TreeNode[] = [new SessionNode(latest, element.worktree.path)];
      if (older.length > 0) {
        children.push(new PreviousSessionsNode(older, element.worktree.path));
      }
      return children;
    }
    if (element.kind === 'previousSessions') {
      return element.sessions.map((s) => new SessionNode(s, element.worktreePath));
    }
    return [];
  }

  private buildProjectFolderItem(data: ProjectData): vscode.TreeItem {
    const item = new vscode.TreeItem(path.basename(data.rootPath), vscode.TreeItemCollapsibleState.Expanded);
    item.description = data.rootPath;
    item.tooltip = data.rootPath;
    item.contextValue = 'projectFolder';
    item.iconPath = new vscode.ThemeIcon('repo');
    return item;
  }

  private buildWorktreeItem(node: WorktreeNode): vscode.TreeItem {
    const { worktree } = node;
    const label = worktree.branch ?? (worktree.detached ? 'detached HEAD' : path.basename(worktree.path));
    const hasSessions = worktree.sessions.length > 0;
    const collapsibleState = hasSessions
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;

    const item = new vscode.TreeItem(label, collapsibleState);
    const rootSuffix = worktree.isMain ? ' · root' : '';
    item.description = (hasSessions ? worktree.path : `${worktree.path} — no sessions`) + rootSuffix;
    item.tooltip = worktree.isMain ? `${worktree.path}\n(main worktree)` : worktree.path;
    item.contextValue = hasSessions ? 'worktree' : 'worktree-empty';

    const iconId = worktree.isMain ? 'home' : 'git-branch';
    let color: vscode.ThemeColor | undefined;
    if (!hasSessions) {
      color = new vscode.ThemeColor('disabledForeground');
    } else if (isOpenInWorkspace(worktree.path)) {
      color = new vscode.ThemeColor('charts.green');
    } else if (worktree.isMain) {
      color = new vscode.ThemeColor('charts.blue');
    }
    item.iconPath = new vscode.ThemeIcon(iconId, color);

    if (!hasSessions) {
      item.command = {
        command: 'claudeSwitcher.createSession',
        title: 'Start New Session',
        arguments: [node],
      };
    }

    return item;
  }

  private buildPreviousSessionsItem(node: PreviousSessionsNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `Previous sessions (${node.sessions.length})`,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    item.contextValue = 'previousSessions';
    item.iconPath = new vscode.ThemeIcon('history');
    return item;
  }

  private buildSessionItem(node: SessionNode): vscode.TreeItem {
    const { session } = node;
    const isActive = findActiveTerminal(session.id) !== undefined;

    const item = new vscode.TreeItem(session.title, vscode.TreeItemCollapsibleState.None);
    item.description = isActive
      ? `${formatRelativeTime(session.updatedAt)} — active`
      : formatRelativeTime(session.updatedAt);
    item.tooltip = `${session.title}\n${session.filePath}\n${session.updatedAt.toLocaleString()}`;
    item.contextValue = 'session';
    item.iconPath = new vscode.ThemeIcon(
      isActive ? 'circle-filled' : 'comment-discussion',
      isActive ? new vscode.ThemeColor('charts.green') : undefined
    );
    item.command = {
      command: 'claudeSwitcher.activateSession',
      title: 'Resume Session',
      arguments: [node],
    };
    return item;
  }
}

function isOpenInWorkspace(worktreePath: string): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.some((f) => path.resolve(f.uri.fsPath) === path.resolve(worktreePath));
}

function latestActivity(project: ProjectData): number {
  let latest = 0;
  for (const wt of project.worktrees) {
    for (const s of wt.sessions) {
      latest = Math.max(latest, s.updatedAt.getTime());
    }
  }
  return latest;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
