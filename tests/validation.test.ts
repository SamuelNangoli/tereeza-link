import test from 'node:test';
import assert from 'node:assert/strict';
import {alias,destination,expiration} from '../lib/validation';
test('normalizes URLs and custom aliases',()=>{assert.equal(alias('My-Campaign'),'my-campaign');assert.equal(destination('https://example.com/a?q=hello#part'),'https://example.com/a?q=hello#part')});
test('rejects dangerous protocols, credentials, local hosts, numeric IP spellings and self loops',()=>{for(const url of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','https://user:pass@example.com','http://localhost','http://127.0.0.1','http://2130706433','http://0x7f000001','http://[::1]','http://[::ffff:127.0.0.1]','http://a.internal','https://example.com:9999','https://link.trenttech.online/abc','https://link.trenttech.online./abc','https://localhost.'])assert.throws(()=>destination(url),Error,url)});
test('rejects routing collisions and malformed aliases',()=>{for(const a of ['admin','API','stats','sw.js','a','a/b','hello world','_next','a'.repeat(41)])assert.throws(()=>alias(a));});
test('blocklist includes subdomains without blocking unrelated suffixes',()=>{process.env.BLOCKED_HOSTS='bad.example';assert.throws(()=>destination('https://sub.bad.example'));assert.equal(destination('https://notbad.example/'),'https://notbad.example/');delete process.env.BLOCKED_HOSTS});
test('expiration enforces future and maximum lifetime',()=>{assert.equal(expiration(null),null);for(const x of ['yesterday',new Date(Date.now()-1000).toISOString(),new Date(Date.now()+400*86400000).toISOString()])assert.throws(()=>expiration(x));assert.ok(expiration(new Date(Date.now()+3600000).toISOString()))});
test('normalizes configured blocked hostnames', () => {
  const previous = process.env.BLOCKED_HOSTS;

  try {
    process.env.BLOCKED_HOSTS = 'BAD.EXAMPLE., Other.Example';

    for (const url of [
      'https://bad.example/',
      'https://sub.bad.example/',
      'https://other.example/',
      'https://sub.other.example/',
    ]) {
      assert.throws(() => destination(url), Error, url);
    }

    assert.equal(
      destination('https://good.example/'),
      'https://good.example/'
    );
  } finally {
    if (previous === undefined) {
      delete process.env.BLOCKED_HOSTS;
    } else {
      process.env.BLOCKED_HOSTS = previous;
    }
  }
});

test('rejects additional special-use domains', () => {
  const blockedUrls = [
    'http://printer.home.arpa/',
    'https://home.arpa/',
    'http://service.onion/',
    'https://example.onion/',
    'https://printer.HOME.ARPA/',
    'https://service.onion./',
  ];

  for (const url of blockedUrls) {
    assert.throws(
      () => destination(url),
      Error,
      `Expected ${url} to be rejected`
    );
  }

  const allowedUrls = [
    'https://example.com/',
    'https://github.com/',
  ];

  for (const url of allowedUrls) {
    assert.doesNotThrow(
      () => destination(url),
      `Expected ${url} to be accepted`
    );
  }
});
