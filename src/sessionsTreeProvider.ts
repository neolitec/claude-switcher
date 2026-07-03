import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeSessionItem, listAllSessions } from './claudeSessionService';
import { listWorktrees, WorktreeInfo } from './gitService';
import { findActiveTerminal, isActiveTerminalForWorktree } from './terminalRegistry';
import { WorktreeColor, worktreeColor } from './worktreeAppearance';
import { WorktreeWatcher } from './worktreeWatcher';
import { buildProjectLayout, RepoWorktrees } from './projectGrouping';
import { resolveRealPath } from './pathIdentity';

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
    readonly worktreePath: string,
    /** Only the latest session of a worktree can show as "active" — only one terminal is tracked per worktree. */
    readonly isLatest: boolean
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

/**
 * The worktree a command should act on. In the expanded view commands fire on a
 * WorktreeNode; in the simplified view the project node stands in for its main
 * worktree, so commands can fire on a ProjectFolderNode too.
 */
export function commandWorktree(node: WorktreeNode | ProjectFolderNode): {
  path: string;
  latestSession: ClaudeSessionItem | undefined;
} {
  const worktree = node.kind === 'worktree' ? node.worktree : node.data.worktrees[0];
  return { path: worktree.path, latestSession: worktree.sessions[0] };
}

export class SessionsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private projects: ProjectData[] = [];
  // When false (default), each worktree shows only its latest session; the
  // "Previous sessions" node is hidden for a cleaner tree. Toggled from the view
  // header.
  private showHistory = false;
  // Watches each repo's `.git/worktrees` so worktrees added/removed after load
  // show up without a manual refresh.
  private readonly worktreeWatcher = new WorktreeWatcher(() => this.refresh());
  private readonly terminalEventListeners: vscode.Disposable[];
  // Bumped on every refresh() call; a call only commits its results if it's
  // still the most recent one by the time it resolves, so a slow refresh can't
  // clobber a faster, more recent one.
  private refreshGeneration = 0;

  constructor() {
    // "Active"/"focused" highlighting is derived live from vscode.window
    // terminals (see terminalRegistry) rather than tracked in memory, so a cheap
    // re-render is all that's needed to pick up terminals opening, closing, or
    // the focused terminal changing.
    this.terminalEventListeners = [
      vscode.window.onDidOpenTerminal(() => this.onDidChangeTreeDataEmitter.fire()),
      vscode.window.onDidCloseTerminal(() => this.onDidChangeTreeDataEmitter.fire()),
      vscode.window.onDidChangeActiveTerminal(() => this.onDidChangeTreeDataEmitter.fire()),
    ];
  }

  dispose(): void {
    this.worktreeWatcher.dispose();
    this.onDidChangeTreeDataEmitter.dispose();
    for (const listener of this.terminalEventListeners) {
      listener.dispose();
    }
  }

  /** Re-renders the tree from already-loaded data, without touching disk or git. */
  rerender(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  setShowHistory(value: boolean): void {
    if (this.showHistory === value) {
      return;
    }
    this.showHistory = value;
    this.onDidChangeTreeDataEmitter.fire();
  }

  async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration;

    const allSessions = await listAllSessions();
    const cwds = Array.from(new Set(allSessions.map((s) => s.cwd).filter((c): c is string => !!c)));

    // `git worktree list` returns every worktree of a repo regardless of which
    // one it's run from, so once a cwd's repo has been resolved, skip spawning
    // git again for any other cwd that turns out to belong to the same repo.
    const worktreesByRealPath = new Map<string, WorktreeInfo[]>();
    const perCwd: { cwd: string; worktrees: WorktreeInfo[] }[] = [];
    for (const cwd of cwds) {
      const cached = worktreesByRealPath.get(resolveRealPath(cwd));
      const worktrees = cached ?? (await listWorktrees(cwd));
      if (!cached) {
        for (const wt of worktrees) {
          worktreesByRealPath.set(resolveRealPath(wt.path), worktrees);
        }
      }
      perCwd.push({ cwd, worktrees });
    }

    // Discover each repo once (keyed by its main worktree), plus non-git cwds.
    const repos: RepoWorktrees[] = [];
    const seenRoots = new Set<string>();
    const standaloneCwds: string[] = [];
    for (const { cwd, worktrees } of perCwd) {
      if (worktrees.length === 0) {
        standaloneCwds.push(cwd);
        continue;
      }
      const root = worktrees[0].path;
      if (!seenRoots.has(root)) {
        seenRoots.add(root);
        repos.push({ root, worktrees });
      }
    }

    const sessionCwds = new Set(cwds.map((c) => resolveRealPath(c)));
    const projects: ProjectData[] = buildProjectLayout(repos, standaloneCwds, sessionCwds).map(
      ({ rootPath, worktrees }) => ({
        rootPath,
        worktrees: worktrees.map((wt) => ({
          ...wt,
          sessions: allSessions
            .filter((s) => s.cwd && resolveRealPath(s.cwd) === resolveRealPath(wt.path))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
        })),
      })
    );

    projects.sort((a, b) => latestActivity(b) - latestActivity(a));

    // A newer refresh() call has since started (and possibly already
    // committed); don't let this slower, stale one overwrite its results.
    if (generation !== this.refreshGeneration) {
      return;
    }

    this.projects = projects;
    this.worktreeWatcher.setRepoRoots(projects.map((p) => p.rootPath));
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === 'projectFolder') {
      return this.showHistory
        ? this.buildProjectFolderItem(element.data)
        : this.buildSimplifiedProjectItem(element.data);
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
      // Expanded view: keep the Project → Worktree nesting.
      if (this.showHistory) {
        return element.data.worktrees.map((wt) => new WorktreeNode(wt));
      }
      // Simplified view: only the latest session matters, and it's represented by
      // the project row itself — so the only children are extra `.claude/worktrees`
      // worktrees (each likewise showing just its latest).
      const [, ...managed] = element.data.worktrees;
      return managed.map((wt) => new WorktreeNode(wt));
    }
    if (element.kind === 'worktree') {
      // Simplified view: the worktree row is its latest session; nothing to expand.
      if (!this.showHistory) {
        return [];
      }
      const [latest, ...older] = element.worktree.sessions;
      if (!latest) {
        return [];
      }
      const children: TreeNode[] = [new SessionNode(latest, element.worktree.path, true)];
      if (older.length > 0) {
        children.push(new PreviousSessionsNode(older, element.worktree.path));
      }
      return children;
    }
    if (element.kind === 'previousSessions') {
      return element.sessions.map((s) => new SessionNode(s, element.worktreePath, false));
    }
    return [];
  }

  /** Expanded view: a plain repo folder that always nests its worktrees. */
  private buildProjectFolderItem(data: ProjectData): vscode.TreeItem {
    const item = new vscode.TreeItem(path.basename(data.rootPath), vscode.TreeItemCollapsibleState.Expanded);
    item.description = data.rootPath;
    item.tooltip = data.rootPath;
    item.contextValue = 'projectFolder';
    item.iconPath = new vscode.ThemeIcon('repo');
    return item;
  }

  /** "<latest title> · running/active" — the latest session a row stands for, plus terminal state. */
  private latestDescription(worktree: WorktreeWithSessions): string {
    const latest = worktree.sessions[0];
    const hasActiveTerminal = findActiveTerminal(worktree.path) !== undefined;
    const isFocused = hasActiveTerminal && isActiveTerminalForWorktree(worktree.path);
    const bits: string[] = [];
    if (latest) {
      bits.push(latest.title);
    }
    if (isFocused) {
      bits.push('active');
    } else if (hasActiveTerminal) {
      bits.push('running');
    } else if (!latest) {
      bits.push('no sessions');
    }
    return bits.join(' · ');
  }

  /**
   * Simplified view: the project node stands in for its main worktree (buttons,
   * colour, resume-on-click). It shows only the latest session, so it expands
   * only when there are extra `.claude/worktrees` worktrees to reveal.
   */
  private buildSimplifiedProjectItem(data: ProjectData): vscode.TreeItem {
    const main = data.worktrees[0];
    const managed = data.worktrees.slice(1);
    const latest = main.sessions[0];
    const hasActiveTerminal = findActiveTerminal(main.path) !== undefined;
    const isLeaf = managed.length === 0;

    const item = new vscode.TreeItem(
      path.basename(data.rootPath),
      isLeaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );
    item.description = this.latestDescription(main);
    item.tooltip = data.rootPath;
    // Same context family as a root worktree, so the +/▶ inline buttons apply.
    item.contextValue = 'worktree-root';
    item.iconPath = new vscode.ThemeIcon(
      'home',
      THEME_COLOR[worktreeColor({ hasActiveTerminal, isMain: true, hasSessions: main.sessions.length > 0 })]
    );
    if (latest) {
      // Click resumes the latest session (an expandable project still keeps this,
      // since the row itself represents that session, not a container to open).
      item.command = {
        command: 'claudeSwitcher.activateSession',
        title: 'Resume Session',
        arguments: [new SessionNode(latest, main.path, true)],
      };
    }
    return item;
  }

  private buildWorktreeItem(node: WorktreeNode): vscode.TreeItem {
    const { worktree } = node;
    const simplified = !this.showHistory;
    const label =
      worktree.branch ?? (worktree.bare ? 'bare' : worktree.detached ? 'detached HEAD' : path.basename(worktree.path));
    const hasSessions = worktree.sessions.length > 0;
    // A live `claude` terminal can exist before Claude Code has persisted the
    // session's .jsonl (it writes it lazily), so reflect the terminal directly
    // rather than waiting for a file that may not appear for a while.
    const hasActiveTerminal = findActiveTerminal(worktree.path) !== undefined;
    // Simplified: a worktree row *is* its latest session — nothing to expand.
    const collapsibleState =
      simplified || !hasSessions ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded;

    const item = new vscode.TreeItem(label, collapsibleState);
    if (simplified) {
      item.description = this.latestDescription(worktree);
      item.tooltip = worktree.path;
    } else {
      const rootSuffix = worktree.isMain ? ' · root' : '';
      const stateSuffix = hasSessions ? '' : hasActiveTerminal ? ' — session starting…' : ' — no sessions';
      item.description = worktree.path + stateSuffix + rootSuffix;
      item.tooltip = worktree.isMain ? `${worktree.path}\n(main worktree)` : worktree.path;
    }
    // The `-root` suffix (main worktree, the home-icon item) lets package.json
    // target it with a "new session" (+) inline button in any state.
    const baseContext = hasSessions ? 'worktree' : hasActiveTerminal ? 'worktree-active' : 'worktree-empty';
    item.contextValue = worktree.isMain ? `${baseContext}-root` : baseContext;

    const iconId = worktree.isMain ? 'home' : 'git-branch';
    const color = THEME_COLOR[worktreeColor({ hasActiveTerminal, isMain: worktree.isMain, hasSessions })];
    item.iconPath = new vscode.ThemeIcon(iconId, color);

    if (!hasSessions && hasActiveTerminal) {
      // Empty worktree with a live terminal: reveal that terminal on click.
      item.command = {
        command: 'claudeSwitcher.revealWorktreeTerminal',
        title: 'Reveal Session Terminal',
        arguments: [node],
      };
    } else if (simplified && hasSessions) {
      // Simplified: the row is a leaf that resumes its latest session on click.
      item.command = {
        command: 'claudeSwitcher.activateSession',
        title: 'Resume Session',
        arguments: [new SessionNode(worktree.sessions[0], worktree.path, true)],
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
    // Only the latest session of a worktree can be "running" (one terminal per worktree).
    const isRunning = node.isLatest && findActiveTerminal(node.worktreePath) !== undefined;
    const isFocused = isRunning && isActiveTerminalForWorktree(node.worktreePath);

    const item = new vscode.TreeItem(session.title, vscode.TreeItemCollapsibleState.None);
    const time = formatRelativeTime(session.updatedAt);
    if (isFocused) {
      item.description = `${time} — active`;
    } else if (isRunning) {
      item.description = `${time} — running`;
    } else {
      item.description = time;
    }
    item.tooltip = `${session.title}\n${session.filePath}\n${session.updatedAt.toLocaleString()}`;
    item.contextValue = 'session';
    // Focused = the terminal you're currently looking at (filled large dot);
    // running = has a live terminal but not the focused one (small dot).
    if (isFocused) {
      item.iconPath = new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('charts.green'));
    } else if (isRunning) {
      item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
    } else {
      item.iconPath = new vscode.ThemeIcon('comment-discussion');
    }
    item.command = {
      command: 'claudeSwitcher.activateSession',
      title: 'Resume Session',
      arguments: [node],
    };
    return item;
  }
}

const THEME_COLOR: Record<WorktreeColor, vscode.ThemeColor | undefined> = {
  green: new vscode.ThemeColor('charts.green'),
  blue: new vscode.ThemeColor('charts.blue'),
  grey: new vscode.ThemeColor('disabledForeground'),
  none: undefined,
};

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
