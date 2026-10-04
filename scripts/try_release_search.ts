export {};

const response = await fetch("http://localhost:3000/search/releases", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "Why did checkout deployment build 1842 fail?",
    topK: 2,
    records: [
      {
        id: "build-1841",
        kind: "build",
        title: "Storefront build 1841 passed",
        detail: "Product page assets compiled and smoke checks passed.",
        occurredAt: "2026-09-30T09:15:00.000Z"
      },
      {
        id: "diag-1842",
        kind: "diagnostic",
        title: "Checkout bundle import failed",
        detail: "Build 1842 could not resolve the payment button module.",
        occurredAt: "2026-10-01T10:42:00.000Z"
      },
      {
        id: "release-77",
        kind: "release",
        title: "Catalog release promoted",
        detail: "Release 77 moved from staging to the production storefront.",
        occurredAt: "2026-10-01T08:00:00.000Z"
      }
    ]
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
