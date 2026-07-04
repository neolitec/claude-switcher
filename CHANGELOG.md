# Changelog

## [0.2.0](https://github.com/neolitec/claude-switcher/compare/v0.1.3...v0.2.0) (2026-07-04)


### Features

* scope the tree to the projects open in the workspace ([c9a1fac](https://github.com/neolitec/claude-switcher/commit/c9a1fac6c659e7c976d516252559596ef5f1a27c))
* scope the tree to the projects open in the workspace ([93286f3](https://github.com/neolitec/claude-switcher/commit/93286f3484c1dfcb37da4173c27a27dc9454354f))


### Bug Fixes

* use correct release-please output keys for root package ([#12](https://github.com/neolitec/claude-switcher/issues/12)) ([97855aa](https://github.com/neolitec/claude-switcher/commit/97855aa39b9b5372b5f3098a65e463520376822e))

## [0.1.3](https://github.com/neolitec/claude-switcher/compare/v0.1.2...v0.1.3) (2026-07-03)


### Miscellaneous

* force release to publish vsix artifact ([#10](https://github.com/neolitec/claude-switcher/issues/10)) ([899e62b](https://github.com/neolitec/claude-switcher/commit/899e62b5cb3fffe51b5ca182d0305b97e31951d8))

## [0.1.2](https://github.com/neolitec/claude-switcher/compare/v0.1.1...v0.1.2) (2026-07-03)


### Bug Fixes

* check PR author instead of triggering actor for dependabot skip ([4390f87](https://github.com/neolitec/claude-switcher/commit/4390f87a7f90cefe4f8710b72751d5e71d065478))
* check PR author instead of triggering actor for dependabot skip ([75735ed](https://github.com/neolitec/claude-switcher/commit/75735edf67fdb138bec1c65e89c4e6ec1a9c4cbb))
* don't fail commitlint on Dependabot PRs ([7f63c34](https://github.com/neolitec/claude-switcher/commit/7f63c346f4abaf74a259f3ac3a59afffa7f039ce))
* exclude generated CHANGELOG.md from prettier check ([02dbe81](https://github.com/neolitec/claude-switcher/commit/02dbe81a374041fd32515907a4f3b7cb60004e5f))
* harden session reading, path matching, and tree refresh from a full codebase review ([#6](https://github.com/neolitec/claude-switcher/issues/6)) ([b5aaed8](https://github.com/neolitec/claude-switcher/commit/b5aaed868d0399e49813a2ad7e2376a65abb364f))

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
