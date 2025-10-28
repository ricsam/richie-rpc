# Branch Protection Setup

This guide explains how to configure branch protection rules to require CI checks before merging pull requests.

## Quick Setup

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Branches**
3. Click **Add rule** or **Add branch protection rule**
4. Configure as described below

## Branch Protection Configuration

### Branch Name Pattern

```
main
```

### Rules to Enable

#### ✅ Require a pull request before merging
- **Required approvals:** 1 (optional, set to 0 if you're solo)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require approval of the most recent reviewable push**

#### ✅ Require status checks to pass before merging
This is the key setting to require CI!

- ✅ **Require branches to be up to date before merging**
- **Status checks that are required:**
  - Search for and select: **`ci`** (this is the job name from `.github/workflows/ci.yml`)

**Important:** The status check won't appear in the list until it has run at least once. Push a commit to trigger the CI workflow first, then come back to add it as a required check.

#### ✅ Require conversation resolution before merging
- Ensures all review comments are addressed

#### ✅ Require signed commits (Optional)
- Only if you want to enforce commit signing

#### ✅ Require linear history (Optional)
- Prevents merge commits (requires rebase or squash)

#### ⚠️ Do not allow bypassing the above settings
- Uncheck this if you need admin override capability
- Or check it for strict enforcement

### Allow Force Pushes

**Allow specified actors to bypass required pull requests:**
- Add: `github-actions[bot]` (if you want GitHub Actions to push tags)

## Why This Matters

### Without Branch Protection
```
❌ Anyone can push directly to main
❌ Can merge broken code
❌ No guarantee tests have run
❌ Code quality issues can slip through
```

### With Branch Protection
```
✅ Must create a pull request
✅ CI must pass (typecheck, lint, tests, E2E)
✅ Code review required (optional)
✅ Cannot merge failing code
✅ Consistent code quality
```

## Testing the Configuration

### 1. Create a Test PR

```bash
# Create a branch
git checkout -b test-branch-protection

# Make a change
echo "# Test" >> TEST.md

# Commit and push
git add TEST.md
git commit -m "test: verify branch protection"
git push origin test-branch-protection
```

### 2. Open Pull Request

1. Go to your repository on GitHub
2. Click **Pull requests** → **New pull request**
3. Select your test branch
4. Create the PR

### 3. Verify CI Runs

You should see:
- ✅ CI workflow starts automatically
- ✅ Status check appears on the PR
- ✅ Merge button is disabled until CI passes

### 4. After CI Passes

- ✅ Merge button becomes enabled
- ✅ Can merge the PR
- ✅ Branch protection working!

## Status Checks Reference

The CI workflow (`.github/workflows/ci.yml`) creates a status check called **`ci`** that includes:

- Type checking all packages
- Linting all files
- Building all packages
- Running integration tests
- Running Playwright E2E tests

This status check must pass before you can merge.

## Troubleshooting

### "No status checks found"

The status check won't appear until it has run at least once:

1. Push any commit to trigger CI
2. Wait for workflow to complete
3. Go back to branch protection settings
4. The `ci` status check should now be visible
5. Select it as required

### "Merge button still enabled"

Make sure:
- ✅ "Require status checks to pass before merging" is checked
- ✅ The `ci` status check is selected in the list
- ✅ Rules are saved

### "CI keeps failing"

Check the workflow run logs:
1. Go to **Actions** tab
2. Click on the failing workflow
3. Review the error logs
4. Fix the issues
5. Push new commits to re-run CI

## Recommended Complete Setup

```
Branch protection rule for: main

✅ Require a pull request before merging
  └─ Required approvals: 1 (or 0 for solo projects)
  
✅ Require status checks to pass before merging
  └─ Require branches to be up to date before merging
  └─ Status checks:
     • ci (from .github/workflows/ci.yml)
     
✅ Require conversation resolution before merging

✅ Require linear history (optional)

✅ Do not allow bypassing the above settings
  └─ Exception: github-actions[bot] (for automated tag pushes)
```

## Alternative: Rulesets (Beta)

GitHub now offers "Rulesets" as an alternative to branch protection rules:

1. Go to **Settings** → **Rules** → **Rulesets**
2. Click **New ruleset** → **New branch ruleset**
3. Configure similar rules with more flexibility

Rulesets offer:
- More granular control
- Better inheritance
- Organization-wide rules
- More conditions

## Benefits

Once configured, your workflow becomes:

```
Developer creates PR
    ↓
CI runs automatically
    ↓
    ├─ ✅ Typecheck
    ├─ ✅ Lint
    ├─ ✅ Build
    ├─ ✅ Integration tests
    └─ ✅ E2E tests
    ↓
All checks pass ✓
    ↓
Review (optional)
    ↓
Merge to main ✅
    ↓
Publish workflow runs (if versions bumped)
```

## Next Steps

1. ✅ Configure branch protection for `main`
2. ✅ Add `ci` as required status check
3. ✅ Test with a PR
4. ✅ Enjoy automated code quality enforcement!

