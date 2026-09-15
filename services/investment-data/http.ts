export async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { "user-agent": "IncomeVentureLab/1.0 educational research", ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export const pct = (latest: number, base: number | undefined) => base && Number.isFinite(base) ? ((latest / base) - 1) * 100 : null;

export function closestBefore(rows: Array<{ date: string; value: number }>, target: Date) {
  const stamp = target.toISOString().slice(0, 10);
  return [...rows].reverse().find(row => row.date <= stamp)?.value;
}
