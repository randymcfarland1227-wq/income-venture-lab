import { getReadyDb } from "@/db";
import { investmentDataState, refreshInvestmentData } from "@/services/investment-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await getReadyDb();
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const result = await refreshInvestmentData(db, refresh);
    return Response.json({ ...(await investmentDataState(db)), refresh: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Investment data is temporarily unavailable." }, { status: 500 });
  }
}
