# Migration from @rfetch to @richie-rpc

This document summarizes the rename from `@rfetch/*` to `@richie-rpc/*`.

## What Changed

### Package Names

| Old Name | New Name |
|----------|----------|
| `@rfetch/core` | `@richie-rpc/core` |
| `@rfetch/server` | `@richie-rpc/server` |
| `@rfetch/openapi` | `@richie-rpc/openapi` |
| `@rfetch/client` | `@richie-rpc/client` |
| `@rfetch/demo` | `@richie-rpc/demo` |

### Project Name

- **Old:** RFetch
- **New:** Richie RPC

### Import Statements

**Before:**
```typescript
import { defineContract } from '@rfetch/core';
import { createRouter } from '@rfetch/server';
import { generateOpenAPISpec } from '@rfetch/openapi';
import { createClient } from '@rfetch/client';
```

**After:**
```typescript
import { defineContract } from '@richie-rpc/core';
import { createRouter } from '@richie-rpc/server';
import { generateOpenAPISpec } from '@richie-rpc/openapi';
import { createClient } from '@richie-rpc/client';
```

## Files Updated

### Code Files (8 files)
- ✅ `packages/core/package.json`
- ✅ `packages/server/package.json` + `index.ts`
- ✅ `packages/openapi/package.json` + `index.ts`
- ✅ `packages/client/package.json` + `index.ts`
- ✅ `packages/demo/package.json` + `contract.ts` + `server.ts` + `client-test.ts`
- ✅ `tsconfig.json`

### Script Files (4 files)
- ✅ `scripts/build.ts`
- ✅ `scripts/publish.ts`
- ✅ `scripts/restore.ts`
- ✅ `scripts/typecheck.ts`

### Documentation (11 files)
- ✅ `README.md`
- ✅ `BUILD.md`
- ✅ `PUBLISHING.md`
- ✅ `SUMMARY.md`
- ✅ `TESTING.md`
- ✅ `packages/*/README.md` (4 files)
- ✅ `.github/CONTRIBUTING.md`
- ✅ `.github/SETUP.md`

### Configuration Files (4 files)
- ✅ `.cursorrules`
- ✅ `.github/workflows/ci.yml`
- ✅ `.github/workflows/publish.yml`
- ✅ `.github/workflows/version-check.yml`

### Shell Scripts (1 file)
- ✅ `packages/demo/verify.sh`

## Total Changes

- **34 files** updated
- **~200 replacements** made
- ✅ All tests passing
- ✅ All type checks passing
- ✅ All lint checks passing

## Reason for Change

The `@rfetch` npm scope was already taken, so we renamed to `@richie-rpc` for availability.

## Migration Date

October 28, 2025

## Status

✅ **Complete** - All references updated and verified working.

