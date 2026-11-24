import {postgresUrl} from '../lib/postgres-url.mjs';
import nextEnv from '@next/env';
import {Client} from 'pg';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const connectionString=process.env.DATABASE_URL_UNPOOLED;
if(!connectionString)throw Error('DATABASE_URL_UNPOOLED is required for migrations. Run neon deploy first.');
if(new URL(connectionString).hostname.includes('-pooler'))throw Error('Migrations require a direct, unpooled connection.');
const client=new Client({connectionString:postgresUrl(connectionString),connectionTimeoutMillis:15000,statement_timeout:30000});
try {
 await client.connect();
 await client.query('BEGIN');
 await client.query("select pg_advisory_xact_lock(hashtext('tereeza-schema-migrations'))");
 await client.query('create schema if not exists tereeza');
 await client.query('revoke all on schema tereeza from public');
 await client.query(`create table if not exists tereeza.schema_migrations(
  name text primary key,checksum text not null,applied_at timestamptz not null default now())`);
 for(const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const sql=await readFile('db/migrations/'+name,'utf8');
  const checksum=createHash('sha256').update(sql).digest('hex');
  const {rows}=await client.query('select checksum from tereeza.schema_migrations where name=$1',[name]);
  if(rows.length){if(rows[0].checksum!==checksum)throw Error('Applied migration changed: '+name);console.log('Already applied: '+name);continue;}
  await client.query(sql);
  await client.query('insert into tereeza.schema_migrations(name,checksum) values($1,$2)',[name,checksum]);
  console.log('Applied: '+name);
 }
 await client.query('COMMIT');
 console.log('Database migrations complete.');
}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('Migration failed:',e.code||e.message);process.exitCode=1;}
finally{await client.end();}
