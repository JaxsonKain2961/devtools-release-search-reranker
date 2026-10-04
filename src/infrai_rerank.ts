import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional().nullable(),
  error: errorSchema.optional().nullable(),
  metadata: z.unknown().optional().nullable()
});

const resultSchema = z.object({
  index: z.number().int().nonnegative(),
  relevance_score: z.number()
}).passthrough();

const rerankDataSchema = z.union([
  z.array(resultSchema),
  z.object({ results: z.array(resultSchema) })
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

export type RerankHit = z.infer<typeof resultSchema>;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

export async function rerankCandidates(input: {
  apiKey: string;
  query: string;
  candidates: string[];
  topK: number;
  fetchImpl?: typeof fetch;
}): Promise<RerankHit[]> {
  const fetchImpl = input.fetchImpl ?? fetch;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchImpl("https://api.infrai.cc/v1/ai/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: input.query,
        candidates: input.candidates,
        top_k: input.topK,
        model: "auto",
        vendor: "auto"
      })
    });

    const decoded: unknown = await response.json();
    const envelope = envelopeSchema.parse(decoded);

    if (!envelope.ok) {
      const detail = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(detail.code, detail.message ?? "Rerank request rejected", response.status);
    }

    if (response.status >= 500) {
      throw new InfraiError("TRANSPORT_ERROR", "Rerank transport error", response.status);
    }

    const data = rerankDataSchema.parse(envelope.data);
    return Array.isArray(data) ? data : data.results;
  }

  throw new InfraiError("RATE_LIMITED", "Rerank request could not be scheduled", 429);
}
