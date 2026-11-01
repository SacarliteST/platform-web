---
name: platform-web-development
description: Develop Scoodle platform-web React features using its Feature-Sliced-lite structure, role guards, runtime configuration, generated Education/Identity clients, and shared Mantine UI patterns.
---

# platform-web development

Read `AGENTS.md` first and `README.md` for runtime commands. Use root `../../PLATFORM.md` only for cross-service flows. Do not touch `Frontend/legacy/platform` unless explicitly requested.

## Place code deliberately

- `app`: configuration, providers, layout and router.
- `pages`: route composition; keep reusable business behavior out of page monoliths.
- `features`: user actions and workflows.
- `entities`: domain display/model logic and API-number normalization.
- `session`: authentication state, guards and role handling.
- `shared`: generic UI, HTTP and utilities.
- `api/education` and `api/identity`: generated Orval code; never edit manually.

Use path parameters for entity identity, preserve deep links and role guards, and reuse `src/shared/ui`. Normalize `.NET number | string` values at the entity boundary. Keep runtime service URLs in `public/runtime-config.json` and the runtime fetch layer.

For backend contract changes, replace the checked-in Swagger through the established workflow and run Orval with `unsandboxed-codegen` outside the sandbox. Then fix handwritten consumers; do not patch generated files.

Preserve existing question payloads, token handoff behavior and authenticated file-download flow. New dependencies, global redesigns, base-URL changes and legacy edits require explicit scope.

Follow `$focused-feature-flow`; use targeted Vitest/typecheck while iterating and one final production build when justified.
