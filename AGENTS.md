# AGENTS.md — Instructions for Codex

## Project
Capacity-aware Roadmap Builder (productivity prototype).

## Stack / constraints
- Next.js (App Router) + TypeScript + Tailwind
- No database for now (no Supabase). Use local JSON + optional localStorage.
- Keep dependencies minimal. Prefer built-in Next/React utilities.
- Target deploy: Vercel (next frame).

## Working style
- Make changes in small, reviewable PRs.
- Always update or add docs when behavior changes.
- Be explicit about tradeoffs and assumptions.

## Commands that must pass
- npm run lint
- npm run build

## PR checklist (Definition of done)
- App builds successfully
- Lint passes
- PR includes:
  - What changed (bullets)
  - How to test (steps)
  - Screenshots/GIF for UI changes (optional but nice)
