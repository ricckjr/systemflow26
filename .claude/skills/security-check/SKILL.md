---
name: security-check
description: Review backend and frontend code for common security issues in a large SaaS application.
---

# Security Check

Use this skill to inspect code for common security risks.

## Purpose

Improve security posture without changing system behavior unnecessarily.

## Focus Areas

- authentication
- authorization
- permission checks
- unsafe input handling
- missing validation
- secret exposure
- CORS configuration
- Docker environment handling
- Supabase access patterns
- insecure defaults

## Instructions

When reviewing code:

1. Identify auth and authorization boundaries.
2. Check whether permission checks follow project standards.
3. Look for exposed secrets, unsafe environment handling or weak defaults.
4. Inspect request validation and input handling.
5. Flag risky database or API access patterns.
6. Highlight practical fixes with minimal disruption.

## Output Format

- Security summary
- Critical risks
- Important weaknesses
- Recommended fixes
- Validation steps

## Project Guidance

For SystemFlow:
- follow existing RBAC and permission patterns
- respect Supabase RLS assumptions
- never recommend manual edits to generated DB types
- check CORS, VITE variables, Docker env flow and privileged backend behavior carefully