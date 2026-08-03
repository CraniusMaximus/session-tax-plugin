---
description: Measure what your Claude Code setup costs before any work starts - opening context, what loads every session, and what never gets used.
---

Run the session-tax audit and explain the result to the operator.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/session-tax-free.mjs" --days 90
```

Then talk them through it, in this order:

1. **Lead with the tax in plain terms.** "Every session starts N tokens deep before you've
   said anything" lands harder than any percentage.
2. **Say whether it's worth acting on.** A big opening context is only a problem if it isn't
   earning its place. Cheap and stable beats clever and fragile - say so when that's the case.
3. **Name one change, not a programme.** The single highest-value thing to cut. A list of
   twelve gets deferred; one gets done.
4. **Offer to make the change.** Pruning is reversible and low risk. Don't hand back homework.

Do not pad the output or repeat the table back at them - they can already see it.
