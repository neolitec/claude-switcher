# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release: Explorer tree view listing Claude Code sessions grouped by project and git worktree.
- Resume a session in an integrated terminal (`claude --resume <id>`), reusing an already-open terminal for that session when one exists.
- Start a brand-new session on worktrees with no Claude Code history yet.
- Read-only Markdown preview of a session's transcript.
- Root worktree gets a distinct icon/label; open workspace folders and active sessions are highlighted.
- Unit test suite (`node:test`) for the git-worktree and session-parsing logic.
