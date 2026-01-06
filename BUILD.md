# Building Richie RPC for npm Publishing

This document explains how to build and publish the Richie RPC packages to npm.

## Build System Overview

The Richie RPC build system creates production-ready npm packages with:

- **Dual module formats**: CommonJS (`.cjs`) and ES Modules (`.mjs`)
- **TypeScript declarations**: Full `.d.ts` files for type safety
- **Proper package.json**: Each format gets its own package.json
- **Workspace dependency resolution**: `workspace:*` → actual version numbers

## Build Scripts

### 1. Build All Packages

```bash
bun run build
```

This builds all 4 publishable packages (`@richie-rpc/core`, `@richie-rpc/server`, `@richie-rpc/openapi`, `@richie-rpc/client`) in order.

**What happens:**

1. Creates `tsconfig.build.json` and `tsconfig.types.json` for each package
2. Compiles TypeScript declaration files (`.d.ts`)
3. Builds CommonJS bundle with Bun (`dist/cjs/index.cjs`)
4. Builds ES Module bundle with Bun (`dist/mjs/index.mjs`)
5. Updates package.json with proper exports and version references
6. Converts `workspace:*` dependencies to actual version numbers

**Output structure per package:**

```
packages/{package}/
├── dist/
│   ├── cjs/
│   │   ├── index.cjs
│   │   ├── index.cjs.map
│   │   └── package.json (type: "commonjs")
│   ├── mjs/
│   │   ├── index.mjs
│   │   ├── index.mjs.map
│   │   └── package.json (type: "module")
│   └── types/
│       └── index.d.ts
├── package.json (updated for publishing)
├── tsconfig.build.json (temporary)
└── tsconfig.types.json (temporary)
```

### 2. Restore Development State

```bash
bun run restore
```

After building, the package.json files are modified for publishing. Use restore to return to development state.

**What happens:**

1. Removes all `dist/` directories
2. Removes temporary `tsconfig.build.json` and `tsconfig.types.json`
3. Restores package.json files from git (workspace dependencies)
4. Reinstalls dependencies

**Important:** Always run restore before continuing development after a build.

### 3. Publish All Packages

```bash
bun run publish:all
```

Publishes all packages to npm in dependency order (core → server/openapi/client).

**Prerequisites:**

1. Packages must be built (`bun run build`)
2. You must be logged in to npm (`npm login`)
3. You must have publish rights to @richie-rpc scope

**What happens:**

1. Verifies all packages are built
2. Publishes `@richie-rpc/core` first
3. Waits 3 seconds
4. Publishes dependent packages
5. Shows summary of published packages

## Build Workflow

### Local Testing

```bash
# 1. Build packages
bun run build

# 2. Test locally if needed (optional)
cd packages/core
npm pack
# Install the .tgz file in another project

# 3. Restore development state
bun run restore
```

### Publishing to npm

```bash
# 1. Update version numbers in package.json files
# packages/core/package.json
# packages/server/package.json
# packages/openapi/package.json
# packages/client/package.json

# 2. Commit version changes
git add packages/*/package.json
git commit -m "chore: bump version to x.x.x"

# 3. Build for production
bun run build

# 4. Publish to npm
bun run publish:all

# 5. Tag the release
git tag v0.1.0
git push --tags

# 6. Restore development state
bun run restore
```

## Build Configuration

Each package gets a custom build configuration:

### tsconfig.build.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "bundler",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    ...
  },
  "include": ["index.ts"]
}
```

### Package Exports

```json
{
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/mjs/index.mjs",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "require": "./dist/cjs/index.cjs",
      "import": "./dist/mjs/index.mjs"
    }
  }
}
```

This ensures proper resolution in all environments:

- Node.js with require() → uses CJS
- Node.js with import → uses MJS
- TypeScript → uses .d.ts files
- Bundlers (Vite, Webpack, etc.) → use MJS

## Peer Dependencies

All published packages use **peer dependencies only** (no bundled dependencies):

```json
{
  "peerDependencies": {
    "@richie-rpc/core": "^0.1.0",
    "typescript": "^5",
    "zod": "^4.1.12"
  }
}
```

**Benefits:**

- Avoids version conflicts
- Users control exact versions
- Smaller package sizes
- No duplicate dependencies in user's node_modules

## Dependency Management

### Development (workspace peerDependencies)

```json
{
  "peerDependencies": {
    "@richie-rpc/core": "workspace:*",
    "zod": "^4.1.12"
  }
}
```

### Production (version references in peerDependencies)

```json
{
  "peerDependencies": {
    "@richie-rpc/core": "^0.1.0",
    "typescript": "^5",
    "zod": "^4.1.12"
  }
}
```

The build script:

1. Removes the `dependencies` field entirely
2. Converts workspace references in `peerDependencies` to version numbers
3. Users must install peer dependencies manually

## Troubleshooting

### Build fails with "module not found"

Make sure all dependencies are installed:

```bash
bun install
```

### TypeScript errors during build

The build uses a custom tsconfig optimized for distribution. If you see errors, check:

1. All imports are valid
2. Types are properly exported
3. No development-only code in production files

### Published package doesn't work

Common issues:

1. **Missing files**: Check `package.json` files array includes `dist`
2. **Wrong imports**: Test the built package locally with `npm pack`
3. **Version mismatch**: Ensure all @richie-rpc dependencies use the same version

### Can't restore after build

If git restore fails:

```bash
# Manually restore package.json files
git checkout packages/core/package.json
git checkout packages/server/package.json
git checkout packages/openapi/package.json
git checkout packages/client/package.json

# Reinstall
bun install
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build packages
        run: bun run build

      - name: Publish to npm
        run: bun run publish:all
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Version Management

The project uses independent versioning for each package. When bumping versions:

1. Update version in each package.json
2. Update dependencies between packages to match
3. Build and publish
4. Tag the release

Example for v0.2.0:

```bash
# Update versions
sed -i '' 's/"version": "0.1.0"/"version": "0.2.0"/g' packages/*/package.json

# Build and publish
bun run build
bun run publish:all

# Tag
git tag v0.2.0
git push --tags

# Restore
bun run restore
```

## Performance

Build times (on M1 Mac):

- @richie-rpc/core: ~100ms
- @richie-rpc/server: ~150ms
- @richie-rpc/openapi: ~150ms
- @richie-rpc/client: ~150ms
- **Total**: ~550ms

The build is fast because:

- Bun's native bundler is extremely fast
- Parallel builds where possible
- Simple module structure (single index.ts per package)
