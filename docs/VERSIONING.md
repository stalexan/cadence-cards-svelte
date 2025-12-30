# Versioning Guide

This project uses **Semantic Versioning (SemVer)** with a `VERSION` file
tracked in git.

## Semantic Versioning Format

Versions follow the `MAJOR.MINOR.PATCH` format:

- **MAJOR**: Incompatible API changes or major feature overhauls
- **MINOR**: New functionality in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

## Version Progression

### Pre-Release Versions (0.x.x)

Start with `0.1.0-beta` and progress through testing phases:

```
0.1.0-alpha   → Very early internal testing
0.1.0-beta    → Feature-complete enough for wider testing
0.1.1-beta    → Bug fixes during beta
0.2.0-beta    → Additional features during beta
0.3.0-beta    → More features/improvements
...
0.9.0-rc1     → Release candidate (final testing before production)
0.9.0-rc2     → Second release candidate (if needed)
1.0.0         → First production-ready release
```

### Production Versions (1.x.x+)

Once at `1.0.0`, follow strict SemVer:

```
1.0.0  → First stable release
1.0.1  → Bug fix
1.1.0  → New feature (backward-compatible)
2.0.0  → Breaking change
```

## Using the VERSION File

The VERSION file is committed to git with a commit message about the new
version number, creating a permanent record of what version each commit
represents. This means even if a tag is accidentally moved, you can always find
the correct commit by checking the VERSION file history.

Note: The VERSION file contains the raw version number (e.g., 0.1.0-beta),
while git tags are prefixed with v (e.g., v0.1.0-beta) by convention to
distinguish them as version tags.

### Creating a New Version

1. **Update the VERSION file:**
   ```bash
   echo "0.1.0-beta" > VERSION
   ```

2. **Commit the version change:**
   ```bash
   git add VERSION
   git commit -m "chore: bump version to 0.1.0-beta"
   ```

3. **Create a git tag:**
   ```bash
   git tag -a v0.1.0-beta -m "Release 0.1.0-beta"
   ```

4. **Push to origin:**
   ```bash
   git push origin main
   git push origin v0.1.0-beta
   ```

   Or push all tags at once:
   ```bash
   git push origin main --tags
   ```

### Viewing Version History

To see all version changes in the project:

```bash
git log --oneline VERSION
```

This shows every commit that modified the VERSION file, giving you a complete
version history.
