# Changelog

## 0.1.1

### Patch Changes

- Switch package management to pnpm and adopt Changesets for changelog/version management.

## 0.1.0 - 2026-07-02

### Added

- Initial release: Explorer tree view listing Claude Code sessions grouped by project and git worktree.
- Resume a session in an integrated terminal (`claude --resume <id>`), reusing the worktree's already-open terminal when one exists — matched across window reloads via env tag, shell-integration cwd, or deterministic terminal name.
- The "+" action always starts a brand-new `claude` session for the worktree; empty worktrees also accept a double-click to start one.
- Simplified/expanded view toggle in the header (persisted): simplified shows one row per project/worktree with only its latest session; expanded reveals the full Project → Worktree → Session nesting with a "Previous sessions" node.
- Read-only Markdown preview of a session's transcript.
- Worktrees under `<repo>/.claude/worktrees/` nest inside their project; hand-made external worktrees appear as their own top-level project only when they contain sessions.
- Highlighting: the focused terminal's session gets a large green dot and follows the active terminal; other live sessions get a small green dot. Root worktree gets a home icon; green (live terminal) / blue (project with no terminal) / grey (empty) colour coding documented in the README.
- Auto-refresh via file-system watchers on `~/.claude/projects` (sessions) and each repo's `.git/worktrees` (worktrees added/removed).
- Unit test suite (`node:test`, ~93% line coverage of the pure logic) covering session parsing and transcript rendering, git-worktree parsing (incl. a real-repo integration test), project/worktree grouping, terminal matching, worktree colour, and double-click detection.
