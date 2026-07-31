---
id: react-query-bulk-mutation-reconcile
trigger: 'when a React-Query mutation fans out multiple writes (Promise.all of assign/unassign, bulk create/delete) and invalidates a query only in onSuccess'
confidence: 0.85
domain: frontend
source: local-repo-analysis
---

# Reconcile bulk mutations on settle, not only on success

## Action

When a `useMutation` `mutationFn` runs several independent writes at once
(`Promise.all([...assign, ...unassign])`), do **not** invalidate/refetch only in
`onSuccess`. `Promise.all` rejects on the **first** failure, but the sibling
writes still hit the server — a partial success. If invalidation lives in
`onSuccess`, it never runs, so the cache keeps the pre-mutation state while the
backend has already changed.

Instead:

- Invalidate the affected queries in `onSettled` (runs on success **and**
  error), so the UI always reflects what actually persisted.
- Prefer `Promise.allSettled` over `Promise.all` and aggregate the per-item
  failures, so one bad item doesn't hide the others' outcomes.
- Keep any field-level error mapping (e.g. tagging the failure with the entity
  id), but treat the list as stale-until-refetched regardless of outcome.

## Why

Concrete failure: a mentor-assignment modal assigned mentor A and B in one
`Promise.all`; A succeeded, B failed with "not active". The mutation went to
`onError`, `invalidateQueries(['event-mentors'])` (in `onSuccess`) never fired,
the list still showed A as unassigned, and re-confirming tried to re-assign A →
"already assigned to this event". The user is stuck in a loop the cache created.
Partial writes are the normal case for multi-call mutations; reconcile on settle.
Same discipline as [[self-review-before-done]] — verify the runtime state, not
the green path.
