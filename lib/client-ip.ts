
/**
 * Extract the client IP from Vercel's trusted forwarding header.
 *
 * Only use this header in Vercel deployments.
 * Outside Vercel, use a shared fallback identifier.
 */
export function clientIp(
  headers: Headers,
  isVercel = Boolean(process.env.VERCEL)
): string {
  if (!isVercel) {
    return 'local';
  }

  const forwarded = headers.get('x-vercel-forwarded-for');

  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
