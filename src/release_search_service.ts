import express from "express";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_rerank.js";
import { releaseSearchRequestSchema, searchReleaseOperations } from "./release_search.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const app = express();
app.use(express.json({ limit: "256kb" }));

app.post("/search/releases", async (request, response) => {
  try {
    const input = releaseSearchRequestSchema.parse(request.body);
    const results = await searchReleaseOperations(input, apiKey);
    response.json({ query: input.query, results });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Invalid search request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.status(status).json({ error: error.message, code: error.code });
      return;
    }
    response.status(500).json({ error: "Search could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Release search listening on http://localhost:${port}`));
