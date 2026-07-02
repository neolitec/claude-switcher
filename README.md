# Claude Switcher

A VS Code extension to browse and resume [Claude Code](https://docs.anthropic.com/claude/docs/claude-code) conversations without leaving the editor.

It scans `~/.claude/projects/`, groups sessions by git repository and worktree, and lets you jump back into any past conversation — or start a new one — from a tree view in the Explorer sidebar.

## Features

- **Project → Worktree → Session tree.** Sessions are discovered from `~/.claude/projects/` and grouped by the git repository (and worktree) they were run in — no need to have the folder open in VS Code first.
- **Latest session surfaced, older ones tucked away.** Each worktree shows only its most recent session; earlier ones live under a collapsible "Previous sessions" node.
- **One click to resume.** Clicking a session opens (or reveals) an integrated terminal running `claude --resume <id>`, and adds the worktree to your workspace if it isn't open yet.
- **Start a fresh session.** Worktrees with no Claude history yet show up dimmed with a "+" action that opens a terminal and runs `claude` there.
- **Active session highlighting.** A session currently running in a terminal is marked with a green dot, even across a VS Code window reload (workspace-folder changes force one — see [Architecture notes](#architecture-notes)).
- **Read-only preview.** Right-click → "Preview Session" renders a session's transcript as Markdown without touching any terminal.
- **Root worktree marker.** The repo's main worktree gets a distinct home icon and a "· root" label so it's never confused with a linked worktree.

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

### Packaging (local only)

```bash
npm run package   # produces a .vsix via @vscode/vsce, does not publish
```

## Architecture notes

- `src/claudeSessionService.ts` and `src/gitService.ts` have no dependency on the `vscode` module and are covered by unit tests in `src/test/`. `src/sessionsTreeProvider.ts`, `src/extension.ts`, and `src/terminalRegistry.ts` are thin VS Code API glue, exercised manually via the Extension Development Host.
- Adding a worktree folder to a single-root VS Code window converts it into a multi-root workspace, which VS Code implements by fully reloading the extension host. Any extension-owned in-memory state is lost in that reload. To survive it, "which session has an active terminal" is _not_ tracked in memory — it's derived by tagging each terminal's environment (`terminalRegistry.ts`) and querying `vscode.window.terminals` live.

## License

MIT — see [LICENSE](LICENSE).
