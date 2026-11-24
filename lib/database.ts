import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { postgresUrl } from './postgres-url.mjs';
import { AppError } from './validation';

let pool: Pool | undefined;
/** Lazy initialization keeps builds independent of credentials and database availability. */
function databasePool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new AppError('Database configuration is incomplete.', 503);
    pool = new Pool({ connectionString: postgresUrl(connectionString), max: 5, idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000, statement_timeout: 10000 });
    pool.on('error', () => console.error('An idle database connection failed.'));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}
export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return databasePool().query<T>(text, values);
}
export type LinkRecord = { id:string;slug:string;url:string;manage_hash:string;
  created_at:string;expires_at:string|null;disabled:boolean;total_clicks:number };
export async function findLink(slug:string) {
  const {rows} = await query<LinkRecord>(`select id,slug,url,manage_hash,created_at,expires_at,disabled,
    total_clicks::float8 as total_clicks from tereeza.links where slug=$1`, [slug]);
  return rows[0];
}
export async function insertLink(slug:string,url:string,expires:string|null,manageHash:string) {
  // A collision returns no row; other database errors propagate normally.
  const {rows}=await query<{slug:string}>(`insert into tereeza.links(slug,url,expires_at,manage_hash)
    values($1,$2,$3,$4) on conflict(slug) do nothing returning slug`,[slug,url,expires,manageHash]);
  return rows[0];
}
export async function consumeLimit(key:string,max:number,seconds:number) {
  const {rows}=await query<{allowed:boolean}>('select tereeza.consume_limit($1,$2,$3) as allowed',[key,max,seconds]);
  return rows[0].allowed;
}
export async function recordClick(id:string,visitor:string,referrer:string,device:string) {
  await query('select tereeza.record_click($1,$2,$3,$4)',[id,visitor,referrer,device]);
}
export async function clickBreakdown(id:string) {
  const {rows}=await query<{day:string;referrer:string;device:string;clicks:number}>(`
    select to_char(day,'YYYY-MM-DD') as day,referrer,device,clicks::float8 as clicks
    from tereeza.daily_clicks where link_id=$1 order by day desc,referrer,device limit 1000`,[id]);
  return rows;
}
export async function listLinks(page:number,slug:string|null) {
  const {rows}=await query(`select slug,url,created_at,expires_at,disabled,total_clicks::float8 as total_clicks
    from tereeza.links where ($1::text is null or slug=$1) order by created_at desc,id desc limit 50 offset $2`,[slug,page*50]);
  return rows;
}
export async function setDisabled(slug:string,disabled:boolean) {
  const {rowCount}=await query('update tereeza.links set disabled=$2 where slug=$1',[slug,disabled]);
  return rowCount===1;
}
export async function addReport(slug:string,reason:string) {
  await query('insert into tereeza.reports(slug,reason) values($1,$2)',[slug,reason]);
}
export async function listReports() {
  const {rows}=await query('select id,slug,reason,created_at from tereeza.reports order by created_at desc,id desc limit 100');
  return rows;
}
