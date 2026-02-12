# @richie-rpc/react-query

## 2.0.0

### Major Changes

- ## Breaking Changes

  ### `errorResponses` — separate error statuses from success responses

  Endpoints now support an `errorResponses` field alongside `responses`. Status codes in `errorResponses` are **thrown** as `ErrorResponse` by the client instead of being returned as data. This enables clean `useSuspenseQuery` patterns where `data` is always the success type.

  ```typescript
  const contract = defineContract({
    getUser: {
      method: 'GET',
      path: '/users/:id',
      responses: {
        [Status.OK]: UserSchema,
      },
      errorResponses: {
        [Status.NotFound]: ErrorSchema,
      },
    },
  });
  ```

  ### `data` renamed to `payload`

  Client responses now use `payload` instead of `data` to avoid the confusing `response.data.data` pattern with TanStack Query.

  ```typescript
  // Before
  const response = await client.getUser({ params: { id: '1' } });
  response.data.name;

  // After
  const response = await client.getUser({ params: { id: '1' } });
  response.payload.name;
  ```

  ### New exports
  - **`ErrorResponse`** class — thrown for `errorResponses` statuses, with `status` and `payload` fields
  - **`TypedErrorResponse<T>`** type — narrows `ErrorResponse` to the specific statuses/payloads from the contract
  - **`isErrorResponse(error, endpoint?)`** — type guard with optional endpoint arg for typed narrowing
  - **`HookError<T>`** type (react-query) — `ErrorResponse | Error` when endpoint has `errorResponses`, else `Error`
  - **`ExtractErrorResponses<T>`** / **`ExtractErrorResponse<T, Status>`** type utilities (core)

  ### Migration guide
  1. Move error status codes from `responses` to `errorResponses` in your contracts
  2. Replace `response.data` with `response.payload` everywhere
  3. Error statuses are now thrown — use `try/catch` with `isErrorResponse()` or TanStack Query's `error` field instead of checking `response.status`

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@2.0.0
  - @richie-rpc/core@2.0.0

## 1.0.11

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@1.2.9

## 1.0.10

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@1.2.8

## 1.0.9

### Patch Changes

- add support for wildcard parameter
- Updated dependencies
  - @richie-rpc/core@1.2.5
  - @richie-rpc/client@1.2.7

## 1.0.8

### Patch Changes

- expand react query API and fix a streaming bug

## 1.0.7

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@1.2.6

## 1.0.6

### Patch Changes

- update build script
- Updated dependencies
  - @richie-rpc/client@1.2.5
  - @richie-rpc/core@1.2.4

## 1.0.5

### Patch Changes

- add support for streaming /1
- Updated dependencies
  - @richie-rpc/client@1.2.4
  - @richie-rpc/core@1.2.3

## 1.0.4

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@1.2.3
  - @richie-rpc/core@1.2.2

## 1.0.3

### Patch Changes

- Updated dependencies
  - @richie-rpc/client@1.2.2

## 1.0.2

### Patch Changes

- Fixed query key structure to ensure React Query properly detects changes in nested options (params, query, headers, body). This fixes an issue where changing query parameters (e.g., search filters) wouldn't trigger refetches.

## 1.0.1

### Patch Changes

- initial release using @changesets/cli
- Updated dependencies
  - @richie-rpc/client@1.2.1
  - @richie-rpc/core@1.2.1
