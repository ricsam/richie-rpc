# GitHub Actions Setup Guide

This guide explains how to configure your GitHub repository for automated CI/CD.

## Required Secrets

### NPM_TOKEN

To publish packages to npm, you need to configure an npm token:

1. **Create an npm token:**
   ```bash
   # Login to npm (if not already)
   npm login
   
   # Generate a token (choose "Automation" type)
   # Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   ```

2. **Add token to GitHub:**
   - Go to your repository on GitHub
   - Navigate to: `Settings` → `Secrets and variables` → `Actions`
   - Click `New repository secret`
   - Name: `NPM_TOKEN`
   - Value: Your npm token
   - Click `Add secret`

### GITHUB_TOKEN

The `GITHUB_TOKEN` is automatically provided by GitHub Actions, no setup needed!

## Workflow Overview

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Push to any branch, all pull requests

**Steps:**
1. Checkout code
2. Setup Bun
3. Install dependencies
4. Type check all packages
5. Lint all files
6. Build all packages
7. Run verification tests
8. Install Playwright and run E2E tests
9. Upload test results as artifacts
10. Restore development state

**Status:** ✅ Must pass before merging PRs

### 2. Publish Workflow (`.github/workflows/publish.yml`)

**Triggers:**
- Push to `main` branch when `packages/*/package.json` changes
- Manual trigger via GitHub UI (with dry-run option)

**Steps:**
1. Run all CI checks
2. Build packages
3. Check if version already published (skip if exists)
4. Publish to npm in order:
   - @rfetch/core (first, as others depend on it)
   - @rfetch/server
   - @rfetch/openapi
   - @rfetch/client
5. Create git tag (e.g., `v0.1.0`)
6. Restore development state

**Manual Trigger:**
- Go to `Actions` tab in GitHub
- Select `Publish to npm` workflow
- Click `Run workflow`
- Choose branch and dry-run option

### 3. Version Check Workflow (`.github/workflows/version-check.yml`)

**Triggers:** Pull requests that modify `packages/*/package.json`

**Purpose:** Reminds reviewers to check version bumps are appropriate

## Publishing Process

### Automated Publishing

1. **Update versions** in all package.json files:
   ```bash
   # Edit packages/core/package.json
   # Edit packages/server/package.json
   # Edit packages/openapi/package.json
   # Edit packages/client/package.json
   ```

2. **Commit and push to main:**
   ```bash
   git add packages/*/package.json
   git commit -m "chore: bump version to 0.2.0"
   git push origin main
   ```

3. **GitHub Actions will automatically:**
   - ✅ Run all tests
   - ✅ Build packages
   - ✅ Check if version exists on npm
   - ✅ Publish packages (if new version)
   - ✅ Create git tag

### Manual Publishing (Backup)

If GitHub Actions fails, you can publish manually:

```bash
# Ensure you're on main with latest code
git checkout main
git pull

# Build packages
bun run build

# Login to npm (if needed)
npm login

# Publish
bun run publish:all

# Restore development state
bun run restore

# Tag the release
VERSION=$(node -p "require('./packages/core/package.json').version")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
```

## Branch Protection Rules (Recommended)

Configure branch protection for `main`:

1. Go to `Settings` → `Branches`
2. Add rule for `main`:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Select: `ci`
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings

## Monitoring

### View Workflow Runs

- Go to `Actions` tab in GitHub
- See all workflow runs and their status
- Click on a run to see detailed logs

### Artifacts

Test results and reports are uploaded as artifacts:
- Playwright test reports (kept for 7 days)
- View in the workflow run summary

## Troubleshooting

### "Version already exists" Error

If you try to publish a version that already exists on npm:
- The workflow will detect this and skip publishing
- No error will occur
- Update the version number and try again

### NPM Authentication Failed

1. Check that `NPM_TOKEN` secret is set correctly
2. Verify the token hasn't expired
3. Regenerate token if needed and update secret

### Tests Failing in CI

1. Run tests locally first: `bun run verify`
2. Check the workflow logs for specific errors
3. E2E tests might need Playwright dependencies installed

### Build Artifacts Remain After Publish

The workflow automatically runs `bun run restore` to clean up build artifacts.

## Cost Considerations

GitHub Actions provides free minutes for public repositories:
- **Public repos:** Unlimited minutes
- **Private repos:** 2,000 minutes/month (free tier)

Each workflow run takes approximately:
- CI: ~5 minutes
- Publish: ~7 minutes

## Security

- ✅ Secrets are encrypted
- ✅ Tokens are never logged
- ✅ Workflows run in isolated containers
- ✅ `GITHUB_TOKEN` has limited permissions

## Next Steps

1. ✅ Set up `NPM_TOKEN` secret
2. ✅ Configure branch protection rules
3. ✅ Make a test commit to verify CI works
4. ✅ Bump version and test publish workflow

For more information, see:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Documentation](https://docs.npmjs.com/cli/v9/commands/npm-publish)

