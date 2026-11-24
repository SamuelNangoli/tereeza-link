import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresUrl} from '../lib/postgres-url.mjs';
test('Neon connections explicitly verify TLS certificates while preserving credentials and options',()=>{
 const input='postgresql://test:p%40ss@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
 const url=new URL(postgresUrl(input));
 assert.equal(url.searchParams.get('sslmode'),'verify-full');
 assert.equal(url.searchParams.get('channel_binding'),'require');
 assert.equal(url.password,'p%40ss');
});
test('local PostgreSQL connection settings are preserved',()=>{
 const input='postgresql://test:password@localhost:5432/testdb';
 assert.equal(postgresUrl(input),input);
});
