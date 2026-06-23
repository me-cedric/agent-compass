---
name: figma-mcp-frontend
description: Use Figma MCP design context to implement frontend screens, design systems, components, and styles.
---

# Figma MCP Frontend

Use when work references a Figma file/frame, design system, component library,
tokens, or visual implementation from design.

## Before Code

1. Read repo UI rules, existing components, tokens, and route/page patterns.
2. Verify Figma MCP tools are available.
3. Pull design context for the selected frame or file.
4. Extract:
   - design tokens: color, type, spacing, radius, shadows
   - components and variants
   - molecular component composition
   - layout constraints and responsive rules
   - states: hover, focus, disabled, loading, empty, error
5. Map Figma components to existing code components before creating new ones.

## Implement

- Reuse existing design system first.
- Create new components only when no matching local component exists.
- Preserve accessibility basics: labels, focus, contrast, keyboard flow.
- Validate visually with screenshot or browser check when UI changed.

## Report

List Figma source, mapped components, changed files, validation, and visual risks.
