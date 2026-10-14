# MongoDB

Detail for SKILL.md, section 4 "MongoDB". The body holds the rules a review always checks; this file holds the rest and how to build them.

## Repositories

- Repositories are the only layer importing the driver or ODM, because use-cases depend on the repository port and stay testable with nothing running.
- Explicit schema validation on what is stored (Mongoose, Zod or JSON Schema).
- Repositories are integration-tested against `mongodb-memory-server` or a test MongoDB (SKILL.md, section 6 "Tests and checks").

## Queries

- Never build a query from unsanitized user input: a value like `{ "$ne": null }` arriving in a body becomes a query operator (operator injection). Validate the input's type with the route schema and pass scalar values, never a raw object, into a filter.
- Use projections instead of fetching full documents, so a new field (a hash, a token) is not read and passed along by accident.
- Index the fields you query or sort on, and say so in the repository next to the query that relies on it, so whoever changes the query sees the index it needs.

## Ownership

- One logical database per service. A service reaches another service's data only through its API or a queue, never by reading its database.
