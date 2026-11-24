import {getDefaultAutoSelectFamilyAttemptTimeout,setDefaultAutoSelectFamilyAttemptTimeout} from 'node:net';

/** Preserve strict certificate verification across pg versions for Neon URLs. */
export function postgresUrl(value) {
  const url = new URL(value);
  if (url.hostname.endsWith('.neon.tech')) {
    // Give distant IPv4 endpoints enough time before trying unavailable IPv6 routes.
    setDefaultAutoSelectFamilyAttemptTimeout(Math.max(2000,getDefaultAutoSelectFamilyAttemptTimeout()));
  }
  if (url.hostname.endsWith('.neon.tech') && ['require', 'prefer', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}
