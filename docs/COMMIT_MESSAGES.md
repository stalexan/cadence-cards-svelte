# Commit Message Conventions

This project follows the **Conventional Commits** specification for commit
messages. This standardizes our git history and enables automated tooling for
versioning, changelog generation, and more.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Commit Types

### `fix:`
Bug fixes that patch incorrect behavior.

**Examples:**
```
fix: resolve preventDefault error in AI-assisted card creation
fix(cards): handle empty deck selection gracefully
fix(api): prevent SQL injection in topic queries
```

### `feat:`
New features or functionality.

**Examples:**
```
feat: add dark mode toggle
feat(cards): implement AI-assisted card generation
feat(api): add rate limiting to card endpoints
```

### `docs:`
Documentation changes only (README, comments, etc.).

**Examples:**
```
docs: update API documentation
docs: add commit message conventions guide
docs(README): clarify installation steps
```

### `style:`
Code style changes that don't affect functionality (formatting, whitespace, etc.).

**Examples:**
```
style: format code with prettier
style(cards): fix indentation in card component
```

### `refactor:`
Code refactoring that doesn't fix bugs or add features.

**Examples:**
```
refactor: extract submission logic into separate function
refactor(api): reorganize card routes
refactor: simplify deck filtering logic
```

### `test:`
Adding or updating tests.

**Examples:**
```
test: add unit tests for card creation
test(api): add integration tests for deck endpoints
```

### `chore:`
Maintenance tasks (build config, dependencies, tooling).

**Examples:**
```
chore: update dependencies
chore: configure ESLint rules
chore(deps): bump react to 18.2.0
```

### `perf:`
Performance improvements.

**Examples:**
```
perf: optimize card query with database index
perf(api): cache topic list responses
```

### `ci:`
CI/CD pipeline changes.

**Examples:**
```
ci: add GitHub Actions workflow
ci: update Docker build configuration
```

## Scope (Optional)

The scope is optional and should be the area of the codebase affected. Common
scopes include:

- Component names: `cards`, `decks`, `topics`
- API routes: `api`, `api/cards`, `api/decks`
- Infrastructure: `docker`, `db`, `config`

**Examples:**
```
feat(cards): add card preview component
fix(api/decks): handle missing topic gracefully
refactor(docker): simplify compose configuration
```

## Description

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize the first letter (unless it's a proper noun)
- No period at the end
- Keep it concise but descriptive

**Good:**
```
fix: resolve preventDefault error when saving cards
feat: add card search functionality
refactor: extract form validation logic
```

**Bad:**
```
fix: Fixed the bug.  (period, past tense)
feat: Added new feature  (past tense)
fix: bug fix  (too vague)
```

## Body (Optional)

Use the body for:
- Explaining **what** and **why** (not **how** - that's in the code)
- Breaking changes
- Additional context

**Example:**
```
fix: resolve preventDefault error in AI-assisted card creation

Extract card submission logic into a separate function that doesn't
require a FormEvent parameter. This allows the AI-assisted component
to call the submission handler directly without passing a fake event
object, fixing the "e.preventDefault is not a function" error.
```

## Footer (Optional)

Use the footer for:
- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Closes #123`, `Fixes #456`

**Example:**
```
feat(api): add pagination to card list endpoint

BREAKING CHANGE: Card list endpoint now requires page and limit query parameters

Closes #123
```

## Examples

### Simple Fix
```
fix: prevent null reference error in deck selection
```

### Feature with Scope
```
feat(cards): add card preview modal
```

### Refactor with Body
```
refactor: extract card submission logic

Separate submission logic from form event handling to allow
reuse in both form submissions and programmatic calls from
AI-assisted component.
```

### Breaking Change
```
feat(api): change card priority format

BREAKING CHANGE: Card priority is now a string ("A", "B", "C")
instead of a number. Update all API clients accordingly.
```

## Benefits

1. **Automated Versioning**: Tools like `semantic-release` can automatically
   bump version numbers based on commit types
2. **Changelog Generation**: Auto-generate changelogs from commit history
3. **Better Git History**: Easier to filter, search, and understand project
   evolution
4. **Team Consistency**: Shared convention makes code reviews and collaboration smoother

## Tools

- [Conventional Commits](https://www.conventionalcommits.org/) - Official specification
- [semantic-release](https://semantic-release.gitbook.io/) - Automated versioning and releases
- [commitlint](https://commitlint.js.org/) - Lint commit messages to enforce conventions

## Quick Reference

| Type | When to Use |
|------|-------------|
| `fix` | Bug fixes |
| `feat` | New features |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `test` | Tests |
| `chore` | Maintenance |
| `perf` | Performance |
| `ci` | CI/CD |

