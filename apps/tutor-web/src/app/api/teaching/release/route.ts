/** Public deployment identity only; no account, lesson or infrastructure secrets. */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const sha = process.env.TEACHING_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  const known = typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
  return Response.json({ sha: known ? sha : null, contract: 1 }, {
    status: known ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
