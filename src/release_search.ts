import { z } from "zod";
import { rerankCandidates, type RerankHit } from "./infrai_rerank.js";

export const releaseSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(300),
  topK: z.number().int().min(1).max(20).default(5),
  records: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(["build", "release", "diagnostic"]),
    title: z.string().min(1),
    detail: z.string().min(1),
    occurredAt: z.string().datetime()
  })).min(1).max(100)
});

export type ReleaseSearchRequest = z.infer<typeof releaseSearchRequestSchema>;

export type RankedReleaseRecord = ReleaseSearchRequest["records"][number] & {
  relevanceScore: number;
};

export function candidateText(record: ReleaseSearchRequest["records"][number]): string {
  return `${record.kind}: ${record.title}\n${record.detail}\nOccurred: ${record.occurredAt}`;
}

export function applyRanking(
  records: ReleaseSearchRequest["records"],
  hits: RerankHit[]
): RankedReleaseRecord[] {
  return hits.map((hit) => {
    const record = records[hit.index];
    if (!record) throw new Error(`Reranker returned unknown candidate index ${hit.index}`);
    return { ...record, relevanceScore: hit.relevance_score };
  });
}

export async function searchReleaseOperations(
  request: ReleaseSearchRequest,
  apiKey: string
): Promise<RankedReleaseRecord[]> {
  const hits = await rerankCandidates({
    apiKey,
    query: request.query,
    candidates: request.records.map(candidateText),
    topK: Math.min(request.topK, request.records.length)
  });
  return applyRanking(request.records, hits);
}
