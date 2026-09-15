import { getReadyDb } from "@/db";
import { loadState, mutate, MutationError, type Mutation } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** Applies one edit and returns the refreshed state, so the client never drifts. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Mutation;
    const db = await getReadyDb();
    const result = await mutate(db, body);
    return Response.json({ ...result, state: await loadState(db) });
  } catch (error) {
    const status = error instanceof MutationError ? 400 : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Could not save." }, { status });
  }
}
