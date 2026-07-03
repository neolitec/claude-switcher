# Claude Switcher

A VS Code extension to browse and resume [Claude Code](https://docs.anthropic.com/claude/docs/claude-code) conversations without leaving the editor.

It scans `~/.claude/projects/`, groups sessions by git repository and worktree, and lets you jump back into any past conversation — or start a new one — from a tree view in the Explorer sidebar.

## Features

- **Project → Worktree → Session tree.** Sessions are discovered from `~/.claude/projects/` and grouped by the git repository (and worktree) they were run in — no need to have the folder open in VS Code first.
- **Simplified vs expanded view.** A toggle in the view header (remembered across reloads) switches between two layouts:
  - **Simplified (default):** every project/worktree is a single clickable row showing only its **latest** session (click resumes it). A project only expands to reveal extra `.claude/worktrees` worktrees — never to list older sessions.
  - **Expanded:** the full Project → Worktree → Session nesting, where each worktree exposes its latest session plus a collapsible "Previous sessions" node.
- **One click to resume.** Clicking a session opens (or reveals) an integrated terminal running `claude --resume <id>`, and adds the worktree to your workspace if it isn't open yet.
- **Start a fresh session.** Worktrees with no Claude history yet show up dimmed with a "+" action that opens a terminal and runs `claude` there.
- **Active session highlighting.** A session running in a terminal is marked with a green dot; the one whose terminal you're currently looking at is highlighted more strongly and follows you as you switch terminals (see [Colour coding](#colour-coding)). This survives a VS Code window reload (workspace-folder changes force one — see [Architecture notes](#architecture-notes)).
- **Read-only preview.** Right-click → "Preview Session" renders a session's transcript as Markdown without touching any terminal.
- **Root worktree marker.** The repo's main worktree gets a distinct home icon and a "· root" label so it's never confused with a linked worktree.

## Colour coding

Icon colours in the tree encode state at a glance:

| Colour / icon              | Where                         | Meaning                                                                                                                      |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Green, large filled dot | Session                       | This session's terminal is the one **currently focused** — the terminal you're looking at. It moves as you switch terminals. |
| 🟢 Green, small filled dot | Session                       | The session has a **live terminal running** `claude`, but it isn't the focused one.                                          |
| 🟢 Green                   | Worktree (home / branch icon) | The worktree has a **live `claude` terminal** running.                                                                       |
| 🔵 Blue                    | Worktree (home icon)          | A **project root with no terminal open** — the everyday "here's a project you can jump into" state.                          |
| ⚪ Dimmed / grey           | Worktree (branch icon)        | An **empty worktree** with no sessions and no terminal (e.g. a freshly created `.claude/worktrees/` worktree).               |

Worktrees created by Claude Code live under `<repo>/.claude/worktrees/` and are nested inside their project. Worktrees you create elsewhere by hand are shown as their own top-level project — but only if they already contain sessions; otherwise they're ignored.

## Requirements

- The [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code) (`claude`) installed and on your `PATH`.
- `git` installed and on your `PATH` (used to discover worktrees).

## Development

```bash
npm install
npm run compile   # or `npm run watch` while iterating
```

Press <kbd>F5</kbd> in VS Code (with this folder open) to launch an Extension Development Host with the extension loaded, or run:

```bash
code --extensionDevelopmentPath=$PWD --new-window
```

### Quality checks

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # node:test unit suite (compiles first)
```

### Packaging

```bash
npm run package   # produces a .vsix via @vscode/vsce, does not publish
```

### Releasing

Merging a conventional-commit PR to `main` triggers [release-please](https://github.com/googleapis/release-please), which opens (or updates) a release PR bumping the version and `CHANGELOG.md`. Merging that release PR creates a GitHub Release, which triggers `.github/workflows/publish.yml` to run `vsce publish` and push the new version to the VS Code Marketplace.

This requires a `VSCE_PAT` repository secret: a Personal Access Token with _Marketplace > Manage_ scope from the Azure DevOps organization backing the `neolitec` publisher (see [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)). The workflow can also be re-run manually (`workflow_dispatch`) to (re-)publish the version currently on `main`.

## Architecture notes

- The `vscode`-free modules hold the logic worth testing and are covered by the `src/test/` unit suite: `claudeSessionService.ts` (session parsing), `gitService.ts` (`git worktree list` parsing), `projectGrouping.ts` (project/worktree layout), `terminalMatching.ts` (terminal ↔ worktree matching), `pathIdentity.ts` (symlink/case-normalized path comparison), and `doubleClick.ts` (double-click timing). The modules that import `vscode` (`sessionsTreeProvider.ts`, `extension.ts`, `terminalRegistry.ts`, the watchers) are thin API glue over those, exercised manually via the Extension Development Host.
- Adding a worktree folder to a single-root VS Code window converts it into a multi-root workspace, which VS Code implements by fully reloading the extension host. Any extension-owned in-memory state is lost in that reload. So "which terminal belongs to which worktree" is _not_ tracked in memory — it's rederived from live terminal signals (env tag, shell-integration cwd, or deterministic name; see `terminalMatching.ts`), each surviving a different kind of reload.
- **Known limitation:** the deterministic-name signal (`Claude · <basename>`) is only a basename, so two worktrees in different repos that happen to share a folder name (e.g. `~/proj-a/frontend` and `~/proj-b/frontend`) are indistinguishable by name alone. If a window reload drops the env tag and shell integration hasn't reported a cwd yet (no other signal available), a terminal can be matched to the wrong worktree's "active"/"running" state until a stronger signal (env tag or shell cwd) becomes available again. Fixing this properly would need a persistent terminal → worktree mapping that survives a full extension host reload (e.g. keyed by the terminal's OS process ID and stored in `workspaceState`), which is a larger feature than the current live-signal approach and hasn't been built.

## License

MIT — see [LICENSE](LICENSE).
