
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../lib/client-ip';

test('extracts the first Vercel forwarded IP', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for':
      '203.0.113.10, 198.51.100.20',
  });

  assert.equal(
    clientIp(headers, true),
    '203.0.113.10'
  );
});

test('trims whitespace from the client IP', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': ' 203.0.113.10 ',
  });

  assert.equal(clientIp(headers, true), '203.0.113.10');
});

test('ignores forwarded headers outside Vercel', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': '203.0.113.10',
  });

  assert.equal(clientIp(headers, false), 'local');
});

test('handles missing forwarded IP headers', () => {
  assert.equal(clientIp(new Headers(), true), 'unknown');
});
