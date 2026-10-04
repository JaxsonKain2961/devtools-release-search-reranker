import assert from "node:assert/strict";
import test from "node:test";
import { applyRanking, releaseSearchRequestSchema } from "../src/release_search.js";

test("puts the checkout diagnostic ahead of an unrelated successful build", () => {
  const input = releaseSearchRequestSchema.parse({
    query: "checkout build failure",
    topK: 2,
    records: [
      {
        id: "build-ok",
        kind: "build",
        title: "Catalog build passed",
        detail: "Static assets compiled.",
        occurredAt: "2026-10-01T08:00:00.000Z"
      },
      {
        id: "checkout-error",
        kind: "diagnostic",
        title: "Checkout import failed",
        detail: "The payment button module was unresolved.",
        occurredAt: "2026-10-01T09:00:00.000Z"
      }
    ]
  });

  const ranked = applyRanking(input.records, [
    { index: 1, relevance_score: 0.96 },
    { index: 0, relevance_score: 0.12 }
  ]);

  assert.deepEqual(ranked.map((record) => record.id), ["checkout-error", "build-ok"]);
  assert.equal(ranked[0]?.relevanceScore, 0.96);
});
