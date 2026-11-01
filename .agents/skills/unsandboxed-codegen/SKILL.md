---
name: unsandboxed-codegen
description: Run project code-generation workflows outside the sandbox. Use for Swagger or OpenAPI export, Orval, NSwag, protobuf generation, ORM scaffolding, generated API clients, and other commands that create or replace generated artifacts.
---

# Unsandboxed codegen

Never run a code generator or any prerequisite process used to produce its input inside the sandbox.

- Identify the repository's established generation command and generated outputs before running it.
- Run the generator with `sandbox_permissions: require_escalated` and a narrowly scoped approval or reusable command prefix.
- Run prerequisite hosts or exporters outside the sandbox as well when they participate in Swagger/OpenAPI or other artifact generation.
- If escalation is rejected or unavailable, stop and report that generation was not performed. Do not retry the generator inside the sandbox.
- Follow the repository's rules for generated files. Do not hand-edit generated artifacts when the project requires regeneration from the source specification.
- After generation, inspect the diff and run the smallest relevant build, typecheck, or contract check. Stop any temporary host or service started for generation.

This skill changes only where generation commands run. It does not grant permission to deploy, publish, commit, or modify unrelated files.

