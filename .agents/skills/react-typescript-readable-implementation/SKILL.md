---
name: react-typescript-readable-implementation
description: Write readable React and TypeScript features with explicit state ownership, small cohesive components, generated API boundaries, and minimal hook or abstraction overhead.
---

# Readable React and TypeScript implementation

Apply `$human-readable-code` together with the repository development skill.

## Component boundaries

- Pages compose routes and features. Move reusable business interaction into the owning feature, not into a generic shared bucket.
- Keep a component together while it expresses one coherent screen or interaction. Split it when a section has independent state, behavior or reuse; do not atomize markup into components with no semantic value.
- Reuse established shared UI before adding another visual wrapper.
- Give event handlers and derived values domain names. Avoid large anonymous callbacks inside JSX when they hide behavior.

## State and hooks

- Keep one source of truth. Derive display state during render instead of copying props or query data into local state.
- Do not use `useEffect` for values that can be derived or for user actions that belong in an event handler.
- Introduce a custom hook only when it owns a coherent reusable behavior or meaningfully simplifies a component.
- Avoid speculative `useMemo`, `useCallback` and global state. Add them for measured behavior or a real identity requirement.
- Represent loading, empty, error, forbidden and success states explicitly.

## Types and API boundaries

- Preserve strict types. Do not use `any`, unchecked casts or non-null assertions to silence a contract mismatch.
- Normalize awkward transport types at an entity, feature or adapter boundary rather than throughout JSX.
- Use generated query and mutation clients; never hand-edit generated API files.
- Keep server error-code mapping centralized when the project already has an error layer.
- Keep runtime URLs, auth and transport behavior in the established configuration and HTTP layers.

## Forms and rendering

- Keep form validation in the established schema/form mechanism and keep server validation visible to the user.
- Prefer clear conditional rendering over nested ternaries.
- Do not create pass-through wrappers that only rename props.
- Preserve keyboard access, labels, disabled/loading states and confirmation for destructive actions.

Tests should exercise what the user sees and can do. Avoid snapshots of large component trees and assertions tied to internal hook structure.

