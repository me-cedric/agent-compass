# Decision log example

Adapted from `caldoai/skills` (MIT). A decision log has two parts. Part 1 lists the problems. Part 2 puts each fix above the problems that it solves.

## Part 1: the problems

```md
- `ui/LogoutDialog.tsx:30` waits 100 ms after it closes and hopes the message input can take focus by then.
- `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions. Each has its own check for when the action is disabled.
- `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu list.
- `ui/CommandPalette.tsx:55` keeps its own list of actions. The list lacks the newer actions.
- `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag. The flag stops the logout dialog that it opens from sending focus to the message input.
- `history/undo.ts:30` has a special case for each action that can be undone.
- `refunds/refund.ts:22` wraps each Stripe call in `if (order.provider === "paypal")`.
- Each action handler must call `track()` by hand, and some do not.
- `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

## Part 2: the fixes

```md
- Make the general `Dialog` give focus back to the element that had it before the dialog opened. The wait and the flag can then go.
  - `ui/LogoutDialog.tsx:30` waits 100 ms after it closes and hopes the message input can take focus by then.
  - `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag.
- Define a `PaymentProvider` interface that Stripe and PayPal both implement. Checkout and refunds then do not know which one they use.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps each Stripe call in `if (order.provider === "paypal")`.
- Make each user action a command with a name, a handler and an undo. The toolbar, menu, shortcuts, palette and undo history then run from one list.
  - `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions.
  - `shortcuts/keymap.ts:18` has a switch with one case per action.
  - `ui/CommandPalette.tsx:55` keeps its own list of actions.
  - `history/undo.ts:30` has a special case for each action.
  - Each action handler must call `track()` by hand.
  - `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

## Tips

- Start from a skeleton: script away the function bodies so the whole codebase fits in context.
- Use subagents to summarize parts of the codebase.
- Script a dependency graph that shows what imports what. Run it again after each fix.
- Start where leverage is highest.
- Keep the decision log in a file. A compaction then loses less.
- Use git history as evidence of how often pieces change, and what changes together.
