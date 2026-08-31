---
id: no-undo-write-needs-a-receipt
trigger: 'when code writes to an external system that accepts the same write twice and offers no delete — a time log, a payment, an invoice line, an email or message send, a webhook delivery, an append-only ledger'
confidence: 0.9
domain: backend
source: host-project-promotion
---

# A write with no undo needs a receipt, and a reconcile path instead of a retry

## Action

Give every such write a **receipt**: the identifier the remote system returned,
stored locally against the local record.

```ts
// Only a real response may create one, and nothing may overwrite one.
stampRemoteId(entry, response.id)   // refuses when entry.remoteId is already set
```

Five rules follow from that:

1. **Only a real response writes the receipt.** A guessed, copied or
   back-filled identifier makes a genuine pending write permanently unsendable,
   and the reconciliation then reports it as already sent when it is not.
2. **Never clear or change an existing receipt.** Clearing one offers the same
   write a second time. Make the setter refuse rather than trusting the caller.
3. **A transport failure is not a failure.** When the answer is lost, the write
   may have landed. Never resolve that by sending again.
4. **Recover by reading the remote side.** Carry a local correlation token in the
   payload — a note, a description suffix, an idempotency key — so a later read
   pairs the remote record back to the local one. That query, not a retry, is the
   recovery path.
5. **Never initiate one of these writes on your own** — not to catch up a log, not
   to reconcile a discrepancy, not to tidy a period. Say which record looks
   missing and let a person decide.

Keep the hand-written document and the synchronisation mirror apart, and never
sum them: the document is committed and authored, the mirror is overwritten whole
by every pull. A record present in both, added together, is counted twice.

## Why

Most write paths are safe to retry because the remote system either rejects the
duplicate or the local side can delete it. This class does neither: the remote
accepts the second copy without complaint, and there is no delete. So the usual
recovery — retry on error — is the failure mode, and it fires exactly when the
system is least observable.

The receipt is what makes the operation idempotent from the caller's side, and the
rules about *who may write it* are the whole difference between a receipt and a
flag. A flag anybody can set is a guess with a database column.

Related: [[async-external-pipeline]] (bounded, recoverable external work),
[[provisioning-state-registry]] (record desired state, not the fact that a write
happened), [[plan-before-operational-change]] (observe, plan, bound, then mutate).
