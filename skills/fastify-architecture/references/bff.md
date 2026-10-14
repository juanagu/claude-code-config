# BFF

Detail for SKILL.md, section 3 "BFF". The body holds the rules a review always checks; this file holds the rest and how to build them.

## Shape

- Same layering and validation as an API (SKILL.md, section 1 "Layers and the dependency rule"); the service layer shapes, aggregates and translates auth/session. Domain logic stays in the services it calls, because a rule implemented in two places drifts.
- A route that only forwards one upstream call needs no `service/`: its controller calls the feature's port directly. Add `service/` when there is shaping, aggregation or a deliberate outcome rule (an always-`200` endpoint, a redirect on OAuth failure).
- One BFF per client surface; its feature folders mirror the client's features, not the backend's internals.
- No database of its own beyond an optional short-TTL cache. Source-of-truth data in a BFF means it has become a microservice: flag it rather than build on it.

## Upstream calls

- Each feature owns its upstream calls: `ports/` declares only the calls that feature makes, with their request/response types beside them; `adapters/` implements them over the shared transport (HTTP client, signed caller headers, timeouts). One client with every upstream operation injected everywhere is the anti-pattern this replaces, because it gives every feature the power to call anything and hides which feature depends on what.
- A feature plugin's options name that port type, never a client with every operation.

## Upstream errors

- An adapter relays an upstream failure by throwing `UpstreamHttpError(status, body)`. Never return `{ ok, status }` from an adapter.
- Why: the central error handler relays the error through the envelope's allow-list of statuses and fields, in the route's existing envelope shape, so no adapter or controller decides what a client sees. A returned `{ ok, status }` pushes that decision into every caller, and each one either forgets to check it or maps it differently, which leaks upstream fields or turns a failure into a `200`.
- The controller does not catch it to map a status (SKILL.md, section 2 "Rules that fail a review").

## Account-existence leak prevention

Where it applies (auth endpoints):

- Password-reset and resend-verification endpoints always return the same success shape for a well-formed body, even on internal failure.
- Any bad token gets one generic `401`.
- Login never distinguishes an unknown email from a wrong password.

These outcomes are deliberate non-error rules, so the catch that produces them lives in the service, named for what it does, never in the controller.
