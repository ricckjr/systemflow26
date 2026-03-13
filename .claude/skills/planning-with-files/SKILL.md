---
name: planning-with-files
description: Plan complex implementation work before editing many files in a large codebase.
---

# Planning With Files

Use this skill before making medium or large changes across multiple files.

## Purpose

Create a structured implementation plan before coding.

Focus on:
- affected files
- dependencies
- risks
- validation steps
- rollout order

## Instructions

Before editing code:

1. Analyze the current structure relevant to the task.
2. Identify the exact files that will likely be changed.
3. Break the work into small implementation phases.
4. Identify risks, blockers, and possible regressions.
5. Define validation steps before any code change.
6. Prefer safe, incremental changes over large rewrites.

## Output Format

- Objective
- Current structure
- Files likely affected
- Risks and dependencies
- Step-by-step plan
- Validation checklist

## Project Guidance

For SystemFlow:
- preserve existing business logic
- avoid broad refactors unless explicitly requested
- respect Supabase, Docker, React Query and RBAC patterns already used
- treat dashboard KPI logic, funnel logic and feed logic as sensitive areas