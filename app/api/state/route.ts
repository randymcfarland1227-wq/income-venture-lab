import { getReadyDb } from "@/db";
import { loadState } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getReadyDb();
    return Response.json(await loadState(db));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the lab." }, { status: 500 });
  }
}
