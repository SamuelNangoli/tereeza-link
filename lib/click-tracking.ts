
import { clientIp } from './client-ip';

export type ClickDetails = {
  visitor: string;
  referrer: string;
  device: 'mobile' | 'desktop';
};

export function isTrackableVisit(headers: Headers): boolean {
  const userAgent = headers.get('user-agent') || '';

  // Speculative loads use ordinary browser user agents, but are not clicks.
  // Check both the current header and its legacy equivalent.
  const isPrefetch = ['sec-purpose', 'purpose'].some((name) =>
    /\bprefetch\b/i.test(headers.get(name) || '')
  );

  return !isPrefetch && !/bot|crawler|spider|preview/i.test(userAgent);
}

export function clickDetails(
  headers: Headers,
  hashVisitor: (value: string) => string,
  date = new Date()
): ClickDetails {
  const userAgent = headers.get('user-agent') || '';

  let referrer = 'direct';

  try {
    referrer = new URL(
      headers.get('referer') || ''
    ).hostname;
  } catch {
    // Keep the direct-visit fallback.
  }

  const ip = clientIp(headers);

  return {
    visitor: hashVisitor(
      date.toISOString().slice(0, 10) + ip
    ),
    referrer: referrer.slice(0, 253),
    device: /mobile|android|iphone/i.test(userAgent)
      ? 'mobile'
      : 'desktop',
  };
}
