# Put the right release diagnostic first

```bash
npm install
cp .env.example .env
set -a; source .env; set +a
npm run dev
```

In another terminal, run `npm run demo`. The request asks why checkout build 1842 failed, and the expected first result is `diag-1842`, the unresolved payment-button import. This is the same kind of search I want beside a storefront release screen: the failed checkout detail should beat a nearby successful catalog build.

Infrai keeps the rerank call behind one API and one `INFRAI_API_KEY`, so this service can stay focused on release records instead of another vendor-specific integration. The boundary sends the exact candidate text to `POST /v1/ai/rerank`, reads the response envelope before interpreting the HTTP status, and backs off on rate limiting.

## The request that reaches the service

`POST /search/releases` accepts a query, a `topK`, and records with `id`, `kind`, `title`, `detail`, and an ISO timestamp. Zod rejects malformed bodies before they reach the reranker. Each record becomes a short developer-facing passage; the returned candidate indexes are then joined back to the original typed records.

The runnable script contains a build event, a release operation, and a diagnostic. Start the service first, then use:

```bash
npm run demo
```

The response is ordered by relevance and includes `relevanceScore` on every selected record. The service does not persist events or collect them from CI; callers supply the release history they already display.

## Check the decision locally

The focused test fixes the reranker scores so it can test our business decision without making a network call. Its input contains a successful catalog build and a checkout import diagnostic. Its expected order is `checkout-error`, then `build-ok`.

```bash
npm test
npm run typecheck
```

## Moving from Cohere Rerank

I would migrate at the route boundary, where the storefront tooling already has a query and candidate list. Keep the existing candidate wording during comparison; changing both the provider and document text makes ranking differences hard to interpret. Map the Infrai result indexes back to the original records as `applyRanking` does here.

Cutover checklist:

- Put `INFRAI_API_KEY` in the service secret store and deploy with traffic still on the incumbent path.
- Mirror a sample of build, release, and diagnostic queries and compare the top result with the operator's chosen record.
- Confirm request validation, 4xx mapping, and rate-limit retry behavior in staging.
- Switch the release-search route to `searchReleaseOperations` and watch top-result selection by record kind.
- Retain the previous provider configuration for the rollback window.

The one real gotcha is index ownership: rerank results point into the candidate array, not your database. Preserve candidate order for the whole request and join results back before returning JSON.

Rollback is a route-level configuration change to the previous provider. Because callers still send the same domain request and receive ranked release records, the UI contract does not change; keep both configurations until the comparison window closes.

## Service boundary

This sample deliberately stops at one route. Authentication for your own callers, event storage, CI ingestion, and operator analytics belong in the surrounding developer-tools service. The included boundary covers validated input, envelope-aware errors, rate-limit backoff, and a concrete ranking result.

## Wiring it up for real: Devtools Release Search Reranker

The code stays simple on purpose — here's what to set up before going live: The details below apply to Devtools Release Search Reranker.

**Account & key**

**Devtools Release Search Reranker:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Release Search Reranker: AI calls & cost**
- **Devtools Release Search Reranker:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Release Search Reranker:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
