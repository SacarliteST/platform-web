---
name: human-readable-code
description: Write or refactor production code so another developer can understand and change it quickly. Use during implementation and code review to prevent unnecessary abstraction, indirection, defensive noise, and unrelated cleanup.
---

# Human-readable code

Prefer the simplest code that makes the required behavior and invariants explicit.

## Make the main path obvious

- Let the public method read top to bottom as the use case: validate the boundary, load state, make the decision, persist, return.
- Use early returns for invalid or exceptional paths instead of deep nesting.
- Name types, methods and variables after domain intent. Avoid vague names such as `Helper`, `Manager`, `Processor`, `Data`, `Info` or `Handle` unless they are already precise in context.
- Keep one level of abstraction inside a method. Do not mix orchestration with low-level parsing, transport or persistence mechanics.
- Keep important state transitions and invariants visible near the state they protect.

## Avoid cleverness

- Do not introduce an interface, generic abstraction, factory, wrapper, builder or extension method for a single trivial use.
- Extract code only when it removes meaningful duplication, names a real concept, isolates infrastructure, or materially reduces cognitive load.
- Do not design speculative extension points for hypothetical future requirements.
- Prefer explicit branches and intermediate variables over dense expressions or fluent chains that hide control flow.
- Do not catch an exception merely to log and rethrow it unchanged.
- Do not add defensive checks already guaranteed by the framework, dependency injection, validated configuration or a preceding boundary.

## Comments and cleanup

- Code should explain what happens; comments should explain why, a non-obvious invariant, compatibility constraint or deliberate tradeoff.
- Remove comments that narrate the next line, dead code, temporary aliases and unused abstractions.
- Keep unrelated refactoring outside the task.
- After behavior works, make one short readability pass: flatten nesting, improve names, remove repetition and verify that every new type earns its existence.

Tests should describe observable behavior and business rules, not duplicate private implementation steps.

