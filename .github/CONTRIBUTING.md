# Contributing to RFetch

Thank you for your interest in contributing to RFetch!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/rfetch.git
cd rfetch

# Install dependencies
bun install

# Run tests
bun run verify
```

## Development Workflow

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and ensure all checks pass:
   ```bash
   bun run typecheck  # Type check all packages
   bun run lint       # Lint code
   bun run verify     # Run integration tests
   ```

3. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. Push and create a pull request:
   ```bash
   git push origin feature/my-feature
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Maintenance tasks

### Versioning

When making changes that should be published:

1. Update version numbers in affected `packages/*/package.json` files
2. Follow [Semantic Versioning](https://semver.org/):
   - **Patch** (0.0.X): Bug fixes and minor changes
   - **Minor** (0.X.0): New features (backwards compatible)
   - **Major** (X.0.0): Breaking changes

3. Keep all package versions in sync for simplicity

### CI/CD Pipeline

When you push to any branch:
- ✅ Type checking runs
- ✅ Linting runs
- ✅ Build runs
- ✅ Tests run (including E2E with Playwright)

When merged to `main` and versions are bumped:
- ✅ All CI checks run
- ✅ Packages are built
- ✅ Packages are published to npm
- ✅ Git tag is created

## Publishing (Maintainers Only)

To publish a new version:

1. Update version in all package.json files:
   ```bash
   # packages/core/package.json
   # packages/server/package.json
   # packages/openapi/package.json
   # packages/client/package.json
   ```

2. Commit and push to main:
   ```bash
   git add packages/*/package.json
   git commit -m "chore: bump version to 0.2.0"
   git push origin main
   ```

3. GitHub Actions will automatically:
   - Run all tests
   - Build packages
   - Publish to npm
   - Create a git tag

### Manual Publishing

If needed, you can publish manually:

```bash
# Build packages
bun run build

# Publish (requires npm authentication)
bun run publish:all

# Restore development state
bun run restore
```

## Testing

### Unit/Integration Tests

```bash
# Run all verification tests
bun run verify
```

### E2E Tests

```bash
cd packages/demo
bun run test:e2e
```

### Manual Testing

```bash
# Start demo server
cd packages/demo
bun run start

# In another terminal, run client tests
bun run client-test.ts

# Visit docs UI
open http://localhost:3000/docs
```

## Project Structure

```
rfetch/
├── packages/
│   ├── core/         # Contract definitions
│   ├── server/       # Server implementation
│   ├── openapi/      # OpenAPI generator
│   ├── client/       # Type-safe client
│   └── demo/         # Integration tests
├── scripts/          # Build and utility scripts
└── .github/          # GitHub Actions workflows
```

## Code Style

- Use TypeScript strict mode
- Follow the existing code style
- Run `bun run format` to auto-format code
- Run `bun run lint:fix` to auto-fix linting issues
- Add types instead of using `any` (exceptions allowed in tests)

## Questions?

Feel free to open an issue for any questions or concerns!

