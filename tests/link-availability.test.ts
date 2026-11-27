
import test from 'node:test';
import assert from 'node:assert/strict';

import { assertLinkAvailable } from '../lib/link-availability';

const now = Date.parse('2026-11-27T12:00:00Z');

test('allows an active link without expiration', () => {
  assert.doesNotThrow(() =>
    assertLinkAvailable({
      disabled: false,
      expires_at: null,
    }, now)
  );
});

test('allows a link expiring in the future', () => {
  assert.doesNotThrow(() =>
    assertLinkAvailable({
      disabled: false,
      expires_at: '2026-11-28T12:00:00Z',
    }, now)
  );
});

test('rejects a nonexistent link with 404', () => {
  assert.throws(
    () => assertLinkAvailable(undefined, now),
    { status: 404, message: 'Link not found.' }
  );
});

test('rejects disabled links with 410', () => {
  assert.throws(
    () => assertLinkAvailable({
      disabled: true,
      expires_at: null,
    }, now),
    {
      status: 410,
      message: 'This link is no longer available.',
    }
  );
});

test('rejects links at the exact expiration time', () => {
  assert.throws(
    () => assertLinkAvailable({
      disabled: false,
      expires_at: '2026-11-27T12:00:00Z',
    }, now),
    { status: 410 }
  );
});

test('rejects links that expired earlier', () => {
  assert.throws(
    () => assertLinkAvailable({
      disabled: false,
      expires_at: '2026-11-26T12:00:00Z',
    }, now),
    { status: 410 }
  );
});




































































