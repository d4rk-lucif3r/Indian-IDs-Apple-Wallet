import { timingSafeEqual } from "node:crypto";
import { ID_TYPES, redisPipeline } from "@/lib/pass/audit";

// Private usage numbers: GET /api/stats with "Authorization: Bearer <STATS_TOKEN>".
// Add ?audit=YYYY-MM-DD to also return that day's anonymous audit records.
function authorised(request: Request) {
  const expected = process.env.STATS_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Not found", { status: 404 });

  const days = [...Array(30)].map((_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const keys = [
    "count:terms_accepted:total",
    "count:pass_created:total",
    ...ID_TYPES.map((t) => `count:pass:${t}:total`),
    ...days.map((d) => `count:pass_created:${d}`),
  ];
  const auditDay = new URL(request.url).searchParams.get("audit");
  const commands: (string | number)[][] = [["MGET", ...keys]];
  if (auditDay && /^\d{4}-\d{2}-\d{2}$/.test(auditDay)) commands.push(["LRANGE", `audit:${auditDay}`, 0, 999]);

  const result = await redisPipeline(commands).catch(() => null);
  if (!result) return Response.json({ error: "Analytics storage is not configured or unreachable." }, { status: 503 });

  const values = (result[0] as (string | null)[]).map((v) => Number(v ?? 0));
  const [termsAccepted, passesCreated, ...rest] = values;
  return Response.json({
    termsAccepted,
    passesCreated,
    byType: Object.fromEntries(ID_TYPES.map((t, i) => [t, rest[i]])),
    passesLast30Days: Object.fromEntries(days.map((d, i) => [d, rest[ID_TYPES.length + i]])),
    ...(commands[1] ? { audit: (result[1] as string[]).map((r) => JSON.parse(r)) } : {}),
  });
}
