---
type: rule
status: active
last_updated: 2026-09-04
---

# academy-brain + Dr Mahmoud MVP → CourseDeveloperStudio Vision Constraint — Binding Rule for All Agents

> [!danger] This is a rule, not a preference. It binds every agent working on any step of [[2026-09-04-academy-brain-mvp-integration]].

## The rule

**No agent may stray from the 9 Codex-reviewed FINAL DECISIONS this ticket is built on, as amended by DEC-004 and DEC-005 (both logged in [[2026-09-04-academy-brain-mvp-integration]] STEP 0a).**

DEC-004 supersedes the original decision 1/2 language about academy-brain being an externally-pinned, separately-versioned release — it now moves into the Studio monorepo as an internal Python component. DEC-005 adds a customer-facing design constraint ("monkey theory") that did not exist in the original 9. Where any older wording anywhere still contradicts DEC-004 or DEC-005, the amendment wins — this is not an agent's judgment call to make.

An agent may suggest improvements. Those suggestions are **bounded by the decisions** — they may refine *how* a step is executed, never *what* the step is or *why* it exists. An agent may not:

- Add a phase, artifact, or deliverable the decisions did not ask for
- Remove, merge, reorder, or "optimize away" a step the decisions specified
- Substitute its own judgment for a stated decision (e.g. reintroducing Redis/RabbitMQ, rewriting academy-brain in C#, keeping silent Supabase/localStorage fallback in production paths, dual-maintaining academy-brain in two repos after DEC-004's cutover, adding a settings/guidance-level dial or any other customer-facing configuration surface after DEC-005 explicitly rejected one)
- Silently resolve an ambiguity by guessing

## What to do instead of guessing

If an agent hits something it genuinely cannot proceed on without inventing an answer, it **stops and escalates to the user (drrefaat18@gmail.com)**. Escalation is reserved for **genuine blockers only** — a real fork where the two paths produce materially different results.

Cosmetic choices — wording, file naming, section ordering, formatting, exact variable names — are **not** blockers; the agent decides those itself and moves on.

Escalations are logged, not just spoken: append to the Blocker Register in [[2026-09-04-academy-brain-mvp-integration]].

## Why this rule exists

This integration merges three codebases at very different maturity levels (a stub-heavy Studio backend, a mature but hardcoded academy-brain pipeline, and an undersold-but-real MVP) built by two different people under an explicit ownership split — the user owns academy-brain's engine, and now owns execution of the whole integration since Dr. Mahmoud delegated it with no separate team. The 9 decisions were reached only after three independent Codex CLI reviews (one per repo, `danger-full-access` sandbox, each reading actual source before ruling) converged on the same resolutions — including catching two live defects (a DI singleton/scoped mismatch, and a `QualityReceipt` property that doesn't exist on the model) and two missing decisions (schema/migration ownership, worker secrets custody) that the original single-pass research missed. An agent re-deciding any of this from scratch mid-execution throws away verified, evidence-cited work and risks reintroducing exactly the demo-shell/localStorage-fallback pattern this integration exists to remove.

DEC-004 and DEC-005 exist because the user — a non-technical (pharmacist) product owner — caught two real problems the first pass missed, after seeing the plan explained in plain language: (1) "externally-pinned separate release" didn't match what he actually meant by "build academy-brain into the studio app," and (2) an adjustable "guidance level" setting, though it was both the assistant's and Codex's first instinct for the resistant-professor adoption problem, is still a decision a technologically-illiterate customer would have to make — which breaks the product's core interaction model. Both reversals went through a fresh Codex read-only review before being logged here, per this project's standing rule that Codex review is mandatory whenever requested, never skippable in favor of the assistant's own judgment.

## Origin

Direct instruction from the user, 2026-09-04: three Codex reviews dispatched (Studio-scope, academy-brain-scope, MVP-scope, all `--sandbox danger-full-access` after two earlier sandbox tiers failed to grant filesystem access), consolidated into 9 FINAL DECISIONS, then scoped via two ticket-builder forks: (1) full integration in one ticket since Dr. Mahmoud delegated the whole thing with no separate team, (2) literal code merge of MVP's lesson-authoring UI into Studio's Next.js frontend rather than keeping it a separately deployed app.

Amended same day, after the ticket was first written: DEC-004 (academy-brain moves into the Studio monorepo — user override of decision 1/2's external-pin language, Codex CONCEDE-WITH-CHANGES) and DEC-005 (zero-configuration "monkey theory" customer design — two Codex rounds, the first proposing then the user rejecting a guidance-level dial, the second converging on the linear-flow-plus-transformation-receipt design now in the ticket).

## Related
- [[2026-09-04-academy-brain-mvp-integration]]
