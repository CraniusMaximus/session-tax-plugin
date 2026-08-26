# session-tax

**Your Claude Code sessions start tens of thousands of tokens deep before you type
anything. This tells you what's in there and how much of it never gets used.**

I ran this against my own setup expecting a tidy number. My median session opens at 51,667
tokens. That's before I say anything — before the first word of the actual work.

Nobody remembers what they installed. You added a skill in March, connected a server in
April, wired four hooks over a weekend that felt productive. All of it still loads on every
session whether it earns its place or not, and nothing in a normal session ever says *"this
one has fired zero times."*

## Install

```
/plugin marketplace add JoeyGorombey/session-tax-plugin
/plugin install session-tax@gorombey-tools
```

Then run `/session-tax` in any session.

Or just run it directly, without installing anything:

```
node scripts/session-tax-free.mjs --days 90
```

## What you get

```
THE BILL
--------
  Every session opens at 51,667 tokens before you type anything.
  The worst tenth open at 71,911.
  Over a year at your pace that is 1,333,607,076 tokens, about $3236.52.

INSTALLED vs ACTUALLY USED
--------------------------
  skills             19 installed     10 fire from the work
                      9 wired to an event, so zero calls is correct
  skill calls       112 total
  servers             4 connected
  hooks              26 wired
```

Plus a ranked breakdown of what loads on every session — skill listings, hook output, tool
schemas, agent listings — each with its own token cost, so you know which one to go after
first.

## About the money figure

It's a rough guide and it says so on screen. Most of your opening context is cache reads
and cache writes, which bill at very different rates from fresh input, so the estimate uses
the split it finds in your own transcripts rather than pricing everything at the list rate.
Doing it the lazy way overstates the bill by roughly ten times.

If you're on a subscription the dollars are beside the point anyway. You're paying in room
to think, and that's the more expensive currency — a session that opens half full reasons
worse the whole way through.

## Skills that never fire

The one finding people don't expect. A skill you have to *remember* is a skill that doesn't
run. Skills that fire from the work, and skills wired to an event, both earn their place —
the ones that wait on you are the dead weight, and they cost tokens on every session
regardless.

The free edition tells you how many you have and what they cost. The paid edition names
them and tells you what to do with each one.

## What it reads, and what it sends

It reads your session transcripts and config files from your own disk. It sends nothing
anywhere — there's no network call in it, and you can confirm that in about a minute:

```
grep -E "fetch|http|net|child_process" scripts/session-tax-free.mjs
```

You'll get three lines back, all of them imports of `fs`, `path` and `os`.

It tells you what to delete. It never deletes anything for you.

## The paid edition — $19

Same measurements, plus the part that turns a report into a change:

- Names every dead skill, cold server and redundant hook, with the specific action for each
- Flags connected servers whose tool schemas load on every session but are never called
- Machine-readable output, and auditing a profile other than your own
- A quiet monthly check, so it happens without you remembering to run it

[operator-shop.pages.dev](https://operator-shop.pages.dev) — one seat per developer.

## Requirements

Node 18 or newer. No dependencies.

## License

MIT. Use it, fork it, take it apart.
