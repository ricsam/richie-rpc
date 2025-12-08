# @richie-rpc/react-query

## 1.0.2

### Patch Changes

- Fixed query key structure to ensure React Query properly detects changes in nested options (params, query, headers, body). This fixes an issue where changing query parameters (e.g., search filters) wouldn't trigger refetches.

## 1.0.1

### Patch Changes

- initial release using @changesets/cli
- Updated dependencies
  - @richie-rpc/client@1.2.1
  - @richie-rpc/core@1.2.1
