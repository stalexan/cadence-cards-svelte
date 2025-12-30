# ESLint TypeScript Configuration

## Overview

This project includes ESLint with TypeScript support to help maintain code quality and catch potential issues early.

## Configuration

### Dependencies

The following packages were added to `package.json`:

- `@eslint/eslintrc` - Compatibility layer for flat config
- `@eslint/js` - ESLint JavaScript configurations
- `@typescript-eslint/eslint-plugin` - TypeScript-specific linting rules
- `@typescript-eslint/parser` - Parser for TypeScript code
- `typescript-eslint` - TypeScript ESLint utilities

### Configuration Files

1. **`eslint.config.mjs`** - Main ESLint configuration using flat config format
   - Extends Next.js core web vitals and TypeScript configs
   - Includes TypeScript-specific rules
   - Configured to warn on `any` types

2. **`.eslintignore`** - Files and directories to ignore during linting
   - Build outputs (`.next/`, `out/`, `dist/`)
   - Dependencies (`node_modules/`)
   - Generated files

### Scripts

Added to `package.json`:

```json
"lint": "next lint"
```

## Key Rules Configured

### TypeScript Rules

- **`@typescript-eslint/no-explicit-any`**: `warn` - Warns when using `any` type (found 113 instances)
- **`@typescript-eslint/no-unused-vars`**: `warn` - Warns about unused variables (ignores underscore-prefixed)
- **`@typescript-eslint/no-non-null-assertion`**: `warn` - Warns on non-null assertions (`!`)

### General Rules

- **`prefer-const`**: `warn` - Suggests using const when variables aren't reassigned
- **`no-var`**: `error` - Prevents use of `var` (use `let` or `const`)

## Usage

### Install Dependencies

In your Docker environment:

```bash
npm install
```

### Run Linting

```bash
# Lint all files
npm run lint

# Lint and fix auto-fixable issues
npm run lint -- --fix

# Lint specific files or directories
npm run lint -- app/api/cards/
```

### VS Code Integration

If using VS Code, install the ESLint extension:

- Extension ID: `dbaeumer.vscode-eslint`

Add to your `.vscode/settings.json`:

```json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Disabling Rules

If you need to disable a rule for a specific line or file:

```typescript
// Disable for a single line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query: any = buildQuery();

// Disable for entire file (use sparingly)
/* eslint-disable @typescript-eslint/no-explicit-any */
```

## Resources

- [TypeScript ESLint](https://typescript-eslint.io/)
- [Next.js ESLint](https://nextjs.org/docs/app/building-your-application/configuring/eslint)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
