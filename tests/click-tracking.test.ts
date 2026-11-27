
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clickDetails,
  isTrackableVisit,
} from '../lib/click-tracking';

test('filters common bot and preview requests', () => {
  for (const agent of [
    'Googlebot',
    'ExampleCrawler',
    'SearchSpider',
    'LinkPreview',
  ]) {
    assert.equal(
      isTrackableVisit(
        new Headers({ 'user-agent': agent })
      ),
      false
    );
  }
});

test('allows ordinary browser visits', () => {
  const headers = new Headers({
    'user-agent': 'Mozilla/5.0',
  });

  assert.equal(isTrackableVisit(headers), true);
});

test('classifies mobile visitors', () => {
  const headers = new Headers({
    'user-agent': 'Mozilla/5.0 (iPhone)',
  });

  const result = clickDetails(
    headers,
    (value) => value,
    new Date('2026-11-26T12:00:00Z')
  );

  assert.equal(result.device, 'mobile');
});

test('classifies desktop visitors', () => {
  const headers = new Headers({
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)',
  });

  const result = clickDetails(
    headers,
    (value) => value,
    new Date('2026-11-26T12:00:00Z')
  );

  assert.equal(result.device, 'desktop');
});

test('extracts referrer hostnames', () => {
  const headers = new Headers({
    referer: 'https://example.com/article?id=123',
  });

  const result = clickDetails(
    headers,
    (value) => value
  );

  assert.equal(result.referrer, 'example.com');
});

test('defaults to direct when referrer is absent', () => {
  const result = clickDetails(
    new Headers(),
    (value) => value
  );

  assert.equal(result.referrer, 'direct');
});

test('uses the UTC date in visitor identifiers', () => {
  const result = clickDetails(
    new Headers(),
    (value) => value,
    new Date('2026-11-26T23:59:00Z')
  );

  assert.equal(result.visitor, '2026-11-26local');
});

test('truncates referrers to 253 characters', () => {
  const hostname = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.example.com`;

  const result = clickDetails(
    new Headers({
      referer: `https://${hostname}/`,
    }),
    (value) => value
  );

  assert.ok(result.referrer.length <= 253);
});

// Speculative browser requests must not consume the daily visitor dedup entry.
test('excludes prefetch and prerender requests with browser user agents', () => {
  for (const purposeHeader of ['sec-purpose', 'purpose']) {
    for (const purpose of ['prefetch', 'prefetch;prerender', 'PREFETCH']) {
      assert.equal(isTrackableVisit(new Headers({
        'user-agent': 'Mozilla/5.0',
        [purposeHeader]: purpose,
      })), false, `${purposeHeader}: ${purpose}`);
    }
  }
});

test('checks both purpose headers when they are present', () => {
  assert.equal(isTrackableVisit(new Headers({
    'user-agent': 'Mozilla/5.0',
    'sec-purpose': 'navigate',
    purpose: 'prefetch',
  })), false);
});

test('allows an actual navigation after speculative loading', () => {
  assert.equal(isTrackableVisit(new Headers({
    'user-agent': 'Mozilla/5.0',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
  })), true);
});
