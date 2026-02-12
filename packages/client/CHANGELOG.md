# @richie-rpc/client

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
  - @richie-rpc/core@2.0.0

## 1.2.9

### Patch Changes

- better error messaging

## 1.2.8

### Patch Changes

- allow transforms on the client

## 1.2.7

### Patch Changes

- Updated dependencies
  - @richie-rpc/core@1.2.5

## 1.2.6

### Patch Changes

- expose ws exports in npm package

## 1.2.5

### Patch Changes

- update build script
- Updated dependencies
  - @richie-rpc/core@1.2.4

## 1.2.4

### Patch Changes

- add support for streaming /1
- Updated dependencies
  - @richie-rpc/core@1.2.3

## 1.2.3

### Patch Changes

- add file upload support
- Updated dependencies
  - @richie-rpc/core@1.2.2

## 1.2.2

### Patch Changes

- add AbortController and jsonSchemaParams support

## 1.2.1

### Patch Changes

- initial release using @changesets/cli
- Updated dependencies
  - @richie-rpc/core@1.2.1
