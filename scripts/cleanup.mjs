import {postgresUrl} from '../lib/postgres-url.mjs';
import nextEnv from '@next/env';import {Client} from 'pg';
nextEnv.loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required.');
const c=new Client({connectionString:postgresUrl(process.env.DATABASE_URL),connectionTimeoutMillis:15000});
try{await c.connect();await c.query('begin');
const statements=[
 "delete from tereeza.rate_limits where started_at < now()-interval '2 days'",
 "delete from tereeza.click_dedup where day < (now() at time zone 'UTC')::date-2",
 "delete from tereeza.daily_clicks where day < (now() at time zone 'UTC')::date-90",
 "delete from tereeza.reports where created_at < now()-interval '90 days'"
];let total=0;for(const sql of statements)total+=(await c.query(sql)).rowCount;
await c.query('commit');console.log('Retention cleanup complete; removed '+total+' stale rows.');
}catch(e){await c.query('rollback').catch(()=>{});console.error('Cleanup failed:',e.code||'database unavailable');process.exitCode=1}finally{await c.end()}
