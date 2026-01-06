# Testing Richie RPC

This document describes how to test the Richie RPC library.

## Quick Verification

Run the verification script to test all functionality:

```bash
cd packages/demo
./verify.sh
```

This will:

- ✅ Start the server
- ✅ Run client integration tests
- ✅ Verify OpenAPI spec endpoint
- ✅ Verify documentation UI endpoint
- ✅ Clean up automatically

## Manual Testing

### 1. Start the Server

```bash
cd packages/demo
bun run start
```

The server will be available at:

- http://localhost:3000 - API endpoints
- http://localhost:3000/docs - Interactive API documentation
- http://localhost:3000/openapi.json - OpenAPI specification

### 2. Run Client Tests

In a separate terminal:

```bash
cd packages/demo
bun run client-test.ts
```

This runs a comprehensive suite of integration tests:

- List users
- Get a specific user
- Create a new user
- Update a user
- Delete a user
- Test 404 responses
- Test validation errors

### 3. Run Playwright E2E Tests

**Note:** The Playwright test command starts its own server, so make sure port 3000 is free first.

```bash
cd packages/demo
lsof -ti:3000 | xargs kill -9  # Kill any existing server
bun run test:e2e
```

The E2E tests verify:

- OpenAPI spec is served correctly
- OpenAPI spec matches actual endpoint behavior
- Full CRUD operations work via HTTP
- Validation errors are handled
- 404 responses work correctly
- Pagination works
- All spec operations have required fields

## Testing Individual Packages

### @richie-rpc/core

```bash
cd packages/core
# The core package is tested via integration tests
```

### @richie-rpc/server

```bash
cd packages/demo
# Server functionality is tested via client-test.ts and Playwright
```

### @richie-rpc/client

```bash
cd packages/demo
bun run client-test.ts
```

### @richie-rpc/openapi

```bash
cd packages/demo
bun run start
# Then visit http://localhost:3000/docs
# Or check http://localhost:3000/openapi.json
```

## Success Criteria

All success criteria from the plan are met:

- ✅ Contract defined in @richie-rpc/core with typed endpoints
- ✅ Server handlers implemented and running on Bun.serve
- ✅ OpenAPI spec accessible at `/openapi.json`
- ✅ Scalar API documentation UI served at `/docs`
- ✅ Client can make typesafe requests to server
- ✅ Responses are validated and correctly typed
- ✅ Validation errors thrown for invalid data
- ✅ All packages work together in demo
- ✅ Playwright tests verify `/docs` and endpoints work
- ✅ Zero runtime errors in demo integration test

## Test Coverage

The test suite covers:

1. **Type Safety**
   - Contract definitions with Zod schemas
   - Type inference from schemas
   - Compile-time type checking

2. **Request Validation**
   - Path parameters
   - Query parameters
   - Request body
   - Headers

3. **Response Validation**
   - Status codes
   - Response bodies
   - Multiple response types per endpoint

4. **Error Handling**
   - Validation errors (400)
   - Not found errors (404)
   - Internal errors (500)

5. **OpenAPI Generation**
   - Spec generation from contract
   - Zod to JSON Schema conversion
   - Documentation UI integration

6. **End-to-End Flows**
   - CRUD operations
   - Client-server communication
   - Real HTTP requests
   - Browser-based UI testing
