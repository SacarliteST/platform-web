---
name: focused-feature-flow
description: Implement or revise a platform-web feature with focused code discovery and proportionate TypeScript, Vitest, and production-build checks instead of rerunning every gate after each edit.
---

# Focused feature flow

1. Read `AGENTS.md`, the requirement, and the directly affected route/feature/entity. Do not browse all pages or planning documents unless the task crosses them.
2. Check `git status`; list the expected UI states, API calls and files. Keep other repositories and unrelated local changes out of scope.
3. Find one existing page or feature with the same interaction pattern and reuse `shared/ui` before inventing a component.
4. Implement a coherent UI slice, then add focused tests for behavior with real risk. Avoid snapshot-heavy tests and assertions about internal component structure.

## Validation ladder

- During editing: rely on TypeScript and run a targeted Vitest file only when useful.
- After the feature is coherent: run `npm.cmd run typecheck` once and the relevant test file/filter.
- On failure: rerun only the failing test or typecheck after the fix.
- After the task is fully implemented: run `npm.cmd run typecheck`, `npm.cmd run test`, and `npm.cmd run build` exactly once as the final acceptance gate. Do not repeat the full suite after each edit.
- Then check only `git status` to avoid staging unrelated user work, stage the task-scoped files, and create the task commit without another broad analysis pass. This repository has no `dotnet format` stage.

Do not run API generation unless Swagger changed. Do not start the dev server, install dependencies, push, or edit another repository unless required. Stop any server started for verification and state what was not tested.
