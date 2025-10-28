# Versioning Strategy

Richie RPC uses **independent versioning** for each package in the monorepo.

## Package Versions

Each package has its own version number and can be released independently:

- `@richie-rpc/core` - Currently at v1.1.0
- `@richie-rpc/server` - Currently at v1.1.0  
- `@richie-rpc/openapi` - Currently at v1.0.0
- `@richie-rpc/client` - Currently at v1.0.0

## Git Tags

Each package release gets its own git tag in the format `package@vX.Y.Z`:

```bash
core@v1.1.0      # @richie-rpc/core version 1.1.0
server@v1.1.0    # @richie-rpc/server version 1.1.0
openapi@v1.0.0   # @richie-rpc/openapi version 1.0.0
client@v1.0.0    # @richie-rpc/client version 1.0.0
```

### Why This Format?

- **Clear**: Immediately know which package and version
- **Standard**: Common pattern in monorepos (Lerna, Nx, etc.)
- **GitHub**: Works with GitHub releases
- **npm**: Matches npm package@version format

## Bumping Versions

### When to Bump

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (X.Y.Z): Bug fixes, no breaking changes
- **Minor** (X.Y.0): New features, backwards compatible
- **Major** (X.0.0): Breaking changes

### Which Packages to Bump

**Option 1: Synchronized (Simpler)**
- Bump all packages together
- Easier to manage
- Users always have matching versions

**Option 2: Independent (Current)**
- Bump only changed packages
- More granular releases
- Smaller changesets

## Publishing Process

### Automatic (CI/CD)

1. Update version in package.json files:
   ```bash
   # Example: Bug fix in server only
   # Edit packages/server/package.json: "version": "1.1.1"
   ```

2. Commit and push:
   ```bash
   git add packages/server/package.json
   git commit -m "chore(server): bump version to 1.1.1"
   git push origin main
   ```

3. GitHub Actions automatically:
   - Runs CI tests
   - Checks which packages have new versions
   - Publishes only updated packages
   - Creates git tags: `server@v1.1.1`

### Manual

```bash
# Build all packages
bun run build

# Publish (only new versions will be published)
bun run publish:all

# Restore
bun run restore

# Create tags manually (if needed)
git tag core@v1.1.0
git push --tags
```

## Tag Management

### List All Tags

```bash
git tag -l
```

### List Tags for Specific Package

```bash
git tag -l "core@v*"
git tag -l "server@v*"
```

### Delete a Tag

```bash
# Local
git tag -d core@v1.0.0

# Remote
git push --delete origin core@v1.0.0
```

### View Tag Details

```bash
git show core@v1.1.0
```

## Changelog

Maintain changelogs per package or use GitHub Releases:

### Per-Package Changelog

```markdown
# @richie-rpc/core

## [1.1.0] - 2025-10-28
### Added
- Status const object for type-safe status codes

## [1.0.0] - 2025-10-28
### Added
- Initial release
```

### GitHub Releases

Create releases for each tag:
- `core@v1.1.0` - Release notes for core package
- `server@v1.1.0` - Release notes for server package

## Version Dependencies

When bumping versions, consider dependencies:

```json
// packages/server/package.json
{
  "peerDependencies": {
    "@richie-rpc/core": "workspace:*"  // Dev: uses workspace
    // After build: "^1.1.0"           // Published: uses version
  }
}
```

**Rules:**
1. If you bump `core`, consider bumping dependent packages (`server`, `client`, `openapi`)
2. Dependent packages can have higher or lower versions than core
3. Use `^` for peer dependencies (allows compatible updates)

## Migration Guide

### From v1.0.0 to v1.1.0

**@richie-rpc/core & @richie-rpc/server:**
- Added: `Status` const object
- No breaking changes
- Fully backwards compatible

**@richie-rpc/openapi & @richie-rpc/client:**
- No changes from v1.0.0

## Best Practices

1. **Document changes** in commit messages
2. **Test thoroughly** before bumping versions
3. **Coordinate releases** when changing APIs
4. **Use tags** to mark releases
5. **Communicate** breaking changes clearly

## Example Scenarios

### Scenario 1: Bug fix in server only

```bash
# Bump server to 1.1.1
packages/server/package.json: "version": "1.1.1"

# Push → CI publishes only server
# Creates tag: server@v1.1.1
```

### Scenario 2: New feature in core (affects all)

```bash
# Bump all to 1.2.0
packages/core/package.json: "version": "1.2.0"
packages/server/package.json: "version": "1.2.0"
packages/openapi/package.json: "version": "1.2.0"
packages/client/package.json: "version": "1.2.0"

# Push → CI publishes all 4 packages
# Creates tags: core@v1.2.0, server@v1.2.0, openapi@v1.2.0, client@v1.2.0
```

### Scenario 3: Breaking change in core

```bash
# Major version bump
packages/core/package.json: "version": "2.0.0"
# Dependent packages should also bump major
packages/server/package.json: "version": "2.0.0"
packages/openapi/package.json: "version": "2.0.0"
packages/client/package.json: "version": "2.0.0"
```

## Current State

As of this writing:

- `@richie-rpc/core@1.1.0` (tag: `core@v1.1.0`)
- `@richie-rpc/server@1.1.0` (tag: `server@v1.1.0`)
- `@richie-rpc/openapi@1.0.0` (tag: `openapi@v1.0.0`)
- `@richie-rpc/client@1.0.0` (tag: `client@v1.0.0`)

