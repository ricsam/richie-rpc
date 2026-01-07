# @richie-rpc/demo

Demo and integration testing package for the Richie RPC library.

## Overview

This package demonstrates a complete working example of the Richie RPC library with:

- ✅ Contract definition with Zod schemas
- ✅ Server implementation with Bun.serve
- ✅ OpenAPI spec generation and serving
- ✅ Scalar API documentation UI
- ✅ React Query hooks integration with live demo
- ✅ Typesafe client usage
- ✅ Full CRUD operations
- ✅ Request/response validation
- ✅ Playwright E2E tests

## Running the Demo

### Start the users demo server

```bash
bun run start
```

The server will start on `http://localhost:3000` with:

- React Query demo app at `/demo` (or `/`)
- API endpoints at `/api/users`
- OpenAPI spec at `/openapi.json`
- API documentation UI at `/docs`

### Start the dictionary demo server

```bash
bun run start:dictionary
```

The dictionary server will start on `http://localhost:3001` with:

- Dictionary React demo app at `/`
- API endpoints at `/api/dictionary`
- OpenAPI spec at `/openapi.json`
- API documentation UI at `/docs`

### Test the client

In a separate terminal:

```bash
bun run client-test.ts
```

This will run through a series of client integration tests demonstrating:

1. Listing users
2. Getting a specific user
3. Creating a new user
4. Updating a user
5. Deleting a user
6. Error handling (404s)
7. Validation errors

### Run E2E tests

```bash
bun run test:e2e
```

This will run Playwright tests that:

- Verify OpenAPI spec is served correctly
- Validate OpenAPI spec matches actual endpoint behavior
- Perform full CRUD operations via HTTP
- Test validation errors
- Test error responses
- Verify all endpoints defined in spec have proper structure

### Run E2E tests with server logs visible

```bash
bun run test:e2e:logs
```

This starts the server manually and pipes all server output to both the console and `.e2e-logs/server.log`. Useful for debugging server-side issues during e2e tests.

**Options:**

```bash
# Run specific test file
bun run test:e2e:logs api

# Run in headed mode (see browser)
bun run test:e2e:logs --headed

# Combine options
bun run test:e2e:logs api --headed

# Run with Playwright UI
bun run test:e2e:logs --ui
```

**Log file location:** `.e2e-logs/server.log`

After tests complete, you can review the full server logs in this file.

**Note:** The HTML report browser is disabled by default when using `test:e2e:logs`. To view the report manually:

```bash
bunx playwright show-report
```

## API Endpoints

### GET /users

List all users with optional pagination.

Query parameters:

- `limit` (optional): Number of users to return
- `offset` (optional): Offset for pagination

### GET /users/:id

Get a specific user by ID.

### POST /users

Create a new user.

Body:

```json
{
  "name": "string",
  "email": "string (email format)",
  "age": "number (optional)"
}
```

### PUT /users/:id

Update a user.

Body:

```json
{
  "name": "string (optional)",
  "email": "string (optional, email format)",
  "age": "number (optional)"
}
```

### DELETE /users/:id

Delete a user.

## Project Structure

### Users Demo

- `contract.ts` - API contract definition with Zod schemas
- `server.ts` - Server implementation with handlers
- `react-example.tsx` - React app demonstrating @richie-rpc/react-query hooks
- `index.html` - HTML page for React demo
- `client-test.ts` - Client integration tests
- `tests/api.spec.ts` - Playwright E2E tests
- `playwright.config.ts` - Playwright configuration

### Dictionary Demo

- `dictionary-contract.ts` - Dictionary API contract definition
- `dictionary-server.ts` - Dictionary server implementation
- `dictionary-example.tsx` - Dictionary React app with search, create, and delete
- `dictionary.html` - HTML page for dictionary demo

## Success Criteria ✅

All success criteria from the plan are met:

- ✅ Contract defined in @richie-rpc/core with typed endpoints
- ✅ Server handlers implemented and running on Bun.serve
- ✅ OpenAPI spec accessible at `/openapi.json`
- ✅ Scalar API documentation UI served at `/docs`
- ✅ Client can make typesafe requests to server
- ✅ Responses are validated and correctly typed
- ✅ Validation errors thrown for invalid data
- ✅ All packages work together in demo
- ✅ Playwright test successfully navigates to `/docs` and tests endpoints
- ✅ Zero runtime errors in demo integration test
