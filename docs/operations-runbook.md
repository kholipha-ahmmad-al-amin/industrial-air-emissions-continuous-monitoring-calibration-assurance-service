# Operations Runbook

## Starting the Service

Install locked dependencies and start the process from the repository root.

```bash
npm ci
PORT=65092 npm start
```

The service listens on `0.0.0.0`. Confirm readiness with `curl http://127.0.0.1:65092/health` before routing approved industrial network clients.

## Request Controls

| Header | Requirement | Operational purpose |
| --- | --- | --- |
| `x-actor-id` | 3 to 128 character identifier | Identifies the accountable operator. |
| `x-actor-role` | One documented calibration role | Enforces separation of duties. |
| `x-request-id` | Unique 8 to 128 character identifier for each mutation | Prevents replay and enables correlation. |

The service provides an `x-request-id` response header for each request. It generates the identifier only when the client omits it, and mutation clients should always provide their own identifier for external audit correlation.

## Data Handling

Runtime state is stored in `data/emissions-calibration.json`. Every save writes a temporary file then atomically renames it into place. Back up the whole data file using an approved host snapshot mechanism or after the process is stopped.

## Incident Handling

Use the response `requestId` when investigating an API failure. `409 conflict` signals a duplicate reading correlation or replayed request identifier. `409 invalid_state` signals a lifecycle action attempted out of sequence. Correct the initiating process rather than editing persisted records directly.

## Graceful Shutdown

Send `SIGTERM` or `SIGINT` to stop the service. The HTTP listener closes before the process exits so a supervisor can remove the service from the network safely.
