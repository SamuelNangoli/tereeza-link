
import ipaddr from 'ipaddr.js';

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

// Reserved aliases that cannot be used for short links
export const reserved = new Set([
  'api',
  'admin',
  'stats',
  'report',
  'privacy',
  'terms',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'offline',
  'favicon.ico',
  'sw.js',
  'icons',
  '_next',
]);

// Validate and normalize custom aliases
export function alias(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9_-]{3,40}$/.test(value) ||
    reserved.has(value.toLowerCase())
  ) {
    throw new AppError(
      'Use 3–40 letters, numbers, hyphens or underscores. This alias may be reserved.'
    );
  }

  return value.toLowerCase();
}

// Normalize hostnames for consistent blocklist comparisons
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '');
}

// Validate destination URLs
export function destination(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new AppError(
      'Enter a URL under 4,096 characters.'
    );
  }

  let u: URL;

  try {
    u = new URL(value);
  } catch {
    throw new AppError(
      'Enter a complete https:// or http:// URL.'
    );
  }

  // Allow only HTTP(S) URLs without credentials or unusual ports
  if (
    !['https:', 'http:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !['80', '443'].includes(u.port))
  ) {
    throw new AppError(
      'Only public HTTP(S) URLs without credentials or unusual ports are allowed.'
    );
  }

  // Normalize destination hostname
  const h = normalizeHost(
    u.hostname.replace(/^\[|\]$/g, '')
  );

  // Reject IP addresses and non-public or special-use domains
  const restrictedDomains = [
    'localhost',
    'local',
    'internal',
    'test',
    'invalid',
    'home.arpa',
    'onion',
  ];

  const isRestrictedDomain = restrictedDomains.some(
    (domain) =>
      h === domain || h.endsWith(`.${domain}`)
  );

  if (
    ipaddr.isValid(h) ||
    !h.includes('.') ||
    isRestrictedDomain
  ) {
    throw new AppError(
      'Use a public domain name, not a local or IP address.'
    );
  }

  // Normalize the application's own hostname
  const own = normalizeHost(
    new URL(
      process.env.SITE_URL ||
        'https://link.trenttech.online'
    ).hostname
  );

  // Normalize all configured blocked hostnames
  const blocked = [
    own,
    ...(process.env.BLOCKED_HOSTS || '')
      .split(',')
      .map(normalizeHost)
      .filter(Boolean),
  ];

  // Reject blocked domains and their subdomains
  if (
    blocked.some(
      (b) => h === b || h.endsWith('.' + b)
    )
  ) {
    throw new AppError(
      'This destination is not allowed.'
    );
  }

  return u.toString();
}

// Validate optional link expiration
export function expiration(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('Invalid expiration.');
  }

  const d = new Date(value);

  if (
    !Number.isFinite(+d) ||
    +d < Date.now() + 60000 ||
    +d > Date.now() + 366 * 86400000
  ) {
    throw new AppError(
      'Expiration must be 1 minute to 1 year from now.'
    );
  }

  return d.toISOString();
}
