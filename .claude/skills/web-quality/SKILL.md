---
name: web-quality
description: Review frontend quality for layout, maintainability, consistency, performance and accessibility.
---

# Web Quality

Use this skill to review frontend code and UI quality in React/Vite applications.

## Purpose

Evaluate frontend implementation quality without unnecessarily changing business logic.

## Focus Areas

- layout quality
- spacing consistency
- typography hierarchy
- component maintainability
- render efficiency
- accessibility basics
- responsiveness
- design consistency
- unnecessary wrappers or nested containers
- poor width usage and excessive empty space

## Instructions

When reviewing frontend code:

1. Analyze the page structure and component composition.
2. Check whether containers use available space efficiently.
3. Detect visual inconsistencies in spacing, padding, borders and alignment.
4. Look for oversized or poorly split components.
5. Flag performance problems such as unnecessary renders where obvious.
6. Suggest improvements that preserve current flows and business rules.

## Output Format

- Summary
- Visual/layout issues
- Maintainability issues
- Performance/accessibility observations
- Recommended improvements
- Safe implementation notes

## Project Guidance

For SystemFlow:
- preserve KPI logic, funnel logic and feed logic unless explicitly requested
- use the existing interface-design system
- keep enterprise SaaS density and clarity
- prefer layout polishing over full redesign