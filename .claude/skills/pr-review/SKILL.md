---
name: pr-review
description: Review changed code like a senior engineer with focus on correctness, regressions and maintainability.
---

# PR Review

Use this skill to review changed files before accepting or merging code.

## Purpose

Review implementation quality with emphasis on correctness and regression prevention.

## Review Areas

- logic correctness
- regressions
- maintainability
- naming clarity
- architecture consistency
- validation coverage
- risky side effects
- unnecessary complexity
- edge cases
- contract preservation

## Instructions

When reviewing code:

1. Understand the purpose of the change.
2. Inspect changed files and surrounding context.
3. Identify bugs, regressions or hidden side effects.
4. Check if existing contracts and business rules were preserved.
5. Flag unsafe refactors or unclear naming.
6. Suggest concrete, minimal fixes.

## Output Format

- Change summary
- Critical issues
- Important improvements
- Minor observations
- Regression risks
- Recommended next actions

## Project Guidance

For SystemFlow:
- do not accept changes that alter dashboard business rules unintentionally
- preserve Supabase and RBAC patterns
- prefer minimal safe edits over architectural churn
- be strict with generated types, permissions and API contracts