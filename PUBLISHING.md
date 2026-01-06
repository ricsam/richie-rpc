# Publishing Richie RPC to npm

Quick reference guide for publishing Richie RPC packages to npm.

## Pre-requisites

1. **npm account**: Create an account at https://www.npmjs.com
2. **npm login**: Run `npm login` and authenticate
3. **Scope access**: Request access to `@richie-rpc` scope (or use your own scope)

## Quick Publish

```bash
# 1. Update versions
# Edit version in packages/*/package.json

# 2. Build all packages
bun run build

# 3. Publish to npm
bun run publish:all

# 4. Tag and push
git tag v0.1.0
git push --tags

# 5. Restore development state
bun run restore
```

## Manual Publish (individual packages)

If you need more control, publish packages individually in this order:

```bash
# Build first
bun run build

# Publish in dependency order
cd packages/core && npm publish
cd ../server && npm publish
cd ../openapi && npm publish
cd ../client && npm publish

# Return to root and restore
cd ../..
bun run restore
```

## Version Strategy

### Synchronized Versioning (Recommended)

Keep all packages at the same version for simplicity:

```json
// All packages
"version": "0.1.0"
```

Update all at once when releasing:

```bash
# Update all package.json versions to 0.2.0
sed -i '' 's/"version": "0.1.0"/"version": "0.2.0"/g' packages/*/package.json
```

### Independent Versioning

Each package can have its own version, but ensure dependency versions match:

```json
// packages/server/package.json
{
  "version": "0.2.0",
  "dependencies": {
    "@richie-rpc/core": "^0.1.5" // Must match published core version
  }
}
```

## Testing Before Publishing

### 1. Local Pack Testing

```bash
# Build and pack
bun run build
cd packages/core
npm pack

# Test in another project
cd /path/to/test-project
npm install /path/to/richie-rpc/packages/core/richie-rpc-core-0.1.0.tgz
```

### 2. Dry Run

```bash
# See what would be published
npm publish --dry-run
```

### 3. Test Registry

Use Verdaccio for local testing:

```bash
# Start local registry
npx verdaccio

# Point to local registry
npm set registry http://localhost:4873/

# Publish and test
bun run publish:all

# Reset to npm registry
npm set registry https://registry.npmjs.org/
```

## Changelog

Maintain a CHANGELOG.md for each release:

```markdown
# Changelog

## [0.2.0] - 2025-01-15

### Added

- New feature X
- Support for Y

### Changed

- Improved Z performance

### Fixed

- Bug in validation

## [0.1.0] - 2025-01-01

- Initial release
```

## Release Checklist

- [ ] Update version numbers in all packages
- [ ] Update CHANGELOG.md
- [ ] Update README.md if needed
- [ ] Run `bun run verify` - all tests pass
- [ ] Run `bun run build` - successful build
- [ ] Review built packages in `packages/*/dist`
- [ ] Run `bun run publish:all` - successful publish
- [ ] Create git tag: `git tag v0.1.0`
- [ ] Push tags: `git push --tags`
- [ ] Run `bun run restore` - return to dev state
- [ ] Create GitHub release with notes
- [ ] Announce on social media/forums

## Troubleshooting

### "You do not have permission to publish"

```bash
# Check you're logged in
npm whoami

# Login if needed
npm login

# Check package scope
# Ensure you have access to @richie-rpc scope
```

### "Package name already exists"

If `@richie-rpc` is taken, use your own scope:

```bash
# Update all package names
# Change @richie-rpc to @yourname in all package.json files
```

### "Version already published"

You cannot republish the same version:

```bash
# Bump version
npm version patch  # 0.1.0 → 0.1.1
# or
npm version minor  # 0.1.0 → 0.2.0
# or
npm version major  # 0.1.0 → 1.0.0
```

### Build artifacts in wrong state

```bash
# Clean everything and restart
bun run restore
rm -rf packages/*/dist
rm -rf node_modules
bun install
bun run build
```

## Package Access

### Public Packages (Free)

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

All Richie RPC packages are configured as public.

### Private Packages (npm Pro)

For private packages, remove the publishConfig or set:

```json
{
  "publishConfig": {
    "access": "restricted"
  }
}
```

## Automation

### GitHub Actions

See `BUILD.md` for CI/CD setup with GitHub Actions.

### npm Scripts

The project includes automation scripts:

- `bun run build` - Build all packages
- `bun run publish:all` - Publish all packages
- `bun run restore` - Restore development state

## Post-Publish

After publishing:

1. **Verify on npm**: Check https://www.npmjs.com/package/@richie-rpc/core
2. **Test installation**: `npm install @richie-rpc/core` in a new project
3. **Update docs**: Ensure documentation reflects new version
4. **Monitor**: Watch for issues in the first 24 hours

## Support

If you encounter issues:

1. Check [BUILD.md](./BUILD.md) for detailed build information
2. Review npm publishing documentation
3. Open an issue in the repository
