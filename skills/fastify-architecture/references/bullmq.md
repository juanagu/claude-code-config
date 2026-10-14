# BullMQ and Redis

Detail for SKILL.md, section 5 "BullMQ and Redis". The body holds the rules a review always checks; this file holds the rest and how to build them.

## When to queue

Queue it when the operation is slow, tolerates eventual completion, needs retries or must not block the response. Keep it synchronous when the caller needs the result to proceed.

## Layout and naming

- Queue names are `<domain>.<action>` (`orders.send-confirmation-email`).
- Queue, processor and worker live under the feature's `jobs/`.

## Processors

- Processors are idempotent: retries and redelivery must not double-charge or double-send. Use a dedupe key where the operation is not naturally idempotent (a job id derived from the business key, or a record of what was already done checked before the side effect).
- Set explicit `attempts` and backoff per job type, chosen for what the job does, because the defaults fit no particular job (a payment and a digest email fail differently).
- Validate job payloads like HTTP input: a payload is external input once it sits in Redis, and an old job can outlive a schema change.
- A processor that should be retried throws; one that catches and returns has told BullMQ it succeeded.

## Workers

- Workers run as their own process in production, so a slow job never holds an HTTP request. Locally that is `npm run dev:worker`; emails don't send without it.
- Failed jobs need visibility: a dead-letter queue, alerting or Bull Board. A job that exhausts its attempts is otherwise lost silently.

## Tests

Processors are unit-tested; `*.redis.test.ts` suites run against a real Redis when `REDIS_TEST_URL` is set (CI sets it) and cover success, the retry path (a throw keeps the job retryable) and idempotency (SKILL.md, section 6 "Tests and checks").
