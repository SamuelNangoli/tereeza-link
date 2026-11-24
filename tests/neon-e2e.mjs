import {postgresUrl} from '../lib/postgres-url.mjs';
/** End-to-end database test. Creates and removes only uniquely named test records. */
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import nextEnv from '@next/env';
import {Pool} from 'pg';
nextEnv.loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL missing: complete neon deploy first.');
const port=Number(process.env.E2E_PORT||3100),base=`http://localhost:${port}`;
const run=randomBytes(6).toString('hex'),slug='e2e-'+run,expired=slug+'-expired';
const password=randomBytes(24).toString('hex'),hashSecret=randomBytes(32).toString('hex');
const hash=s=>createHmac('sha256',hashSecret).update(s).digest('hex');
const limitKeys=['create','stats','login','report'].map(s=>hash(s+'local'));
const concurrencyKey='e2e-concurrency-'+run;
const pool=new Pool({connectionString:postgresUrl(process.env.DATABASE_URL),max:5,connectionTimeoutMillis:15000});
let cookie='',app,appLog='';
async function call(path,method='GET',body,auth,extra={}){
 const r=await fetch(base+path,{method,redirect:'manual',headers:{Origin:base,
  'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),
  ...(auth?{Authorization:'Bearer '+auth}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 let b;try{b=await r.clone().json()}catch{}
 return {r,b};
}
try{
 const {rows}=await pool.query('select 1 as connected');assert.equal(rows[0].connected,1);
 const tlsClient=await pool.connect();
 const encrypted=tlsClient.connection.stream.encrypted===true;
 const verified=tlsClient.connection.stream.authorized===true;
 tlsClient.release();
 const local=['localhost','127.0.0.1','::1'].includes(new URL(process.env.DATABASE_URL).hostname);
 if(!local){assert.equal(encrypted,true,'Remote app connection must use TLS.');assert.equal(verified,true,'Database certificate must be verified.');}
 console.log('PASS PostgreSQL: authenticated '+(encrypted?'TLS (verified certificate)':'local')+' query.');
 // Abort rather than sending a request to another app already using the test port.
 try{await fetch(base,{signal:AbortSignal.timeout(500)});throw Error('E2E port is already in use.')}catch(e){if(e.message==='E2E port is already in use.')throw e;}
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{
  env:{...process.env,SITE_URL:base,ADMIN_PASSWORD:password,IP_HASH_SECRET:hashSecret,
   SESSION_SECRET:randomBytes(32).toString('hex'),VERCEL:'',WEB_RISK_API_KEY:'',REQUIRE_THREAT_CHECK:'false'},
  stdio:['ignore','pipe','pipe']});
 for(const stream of [app.stdout,app.stderr])stream.on('data',d=>{appLog+=d.toString()});
 let ready=false;for(let i=0;i<100;i++){
  if(app.exitCode!==null)throw Error('Test app exited before startup.');
  try{const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 assert.ok(ready,'Production app must start.');console.log('PASS production Next.js app started on '+base);
 let {r,b}=await call('/api/links','POST',{url:'https://example.com/tereeza-neon-test',alias:slug});
 assert.equal(r.status,201,JSON.stringify(b));assert.equal(b.shortUrl,base+'/'+slug);const secret=b.manageToken;
 console.log('PASS POST /api/links: 201, persisted custom alias.');
 assert.equal((await call('/api/links','POST',{url:'https://example.com',alias:slug})).r.status,409);
 assert.equal((await call('/api/links','POST',{url:'http://127.0.0.1'})).r.status,400);
 assert.equal((await call('/api/links','POST',null)).r.status,400);
 assert.equal((await call('/api/links','POST',{url:'https://example.com'},null,{Origin:'https://evil.example'})).r.status,403);
 assert.equal((await call('/api/admin/links')).r.status,401);
 assert.equal((await call('/api/stats/'+slug)).r.status,401);
 assert.equal((await call('/api/stats/'+slug,'GET',undefined,'wrong-token')).r.status,401);
 console.log('PASS alias collision, URL/JSON validation, wrong-origin rejection, private analytics and admin authorization.');
 ({r}=await call('/'+slug,'GET',undefined,null,{'User-Agent':'TereezaIntegrationBrowser','Referer':'https://source.example/private/path?secret=not-stored'}));
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://example.com/tereeza-neon-test');
 assert.match(r.headers.get('cache-control'),/no-store/);
 let stats;for(let i=0;i<30;i++){stats=await call('/api/stats/'+slug,'GET',undefined,secret);if(stats.b?.link?.total_clicks===1)break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(stats.r.status,200);assert.equal(stats.b.link.total_clicks,1);
 assert.equal(stats.b.clicks[0].referrer,'source.example');assert.equal(stats.b.clicks[0].clicks,1);
 assert.equal('manage_hash' in stats.b.link,false);
 await call('/'+slug);await call('/'+slug,'HEAD');await call('/'+slug,'GET',undefined,null,{'User-Agent':'Googlebot'});
 await new Promise(r=>setTimeout(r,300));
 assert.equal((await call('/api/stats/'+slug,'GET',undefined,secret)).b.link.total_clicks,1);
 console.log('PASS redirect 302, no-store, recorded click, referrer privacy, deduplication, HEAD/bot exclusion.');
 await pool.query(`insert into tereeza.links(slug,url,manage_hash,expires_at) values($1,'https://example.com','e2e',now()-interval '1 day')`,[expired]);
 assert.equal((await call('/'+expired)).r.status,410);
 assert.equal((await call('/e2e-missing-'+run)).r.status,404);
 ({r}=await call('/api/admin/session','POST',{password}));assert.equal(r.status,200);
 assert.match(r.headers.get('set-cookie'),/HttpOnly/i);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/i);
 cookie=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/api/admin/links?search='+slug)).b.links[0].slug,slug);
 assert.equal((await call('/api/admin/links','PATCH',{slug,disabled:true})).r.status,200);
 assert.equal((await call('/'+slug)).r.status,410);
 assert.equal((await call('/api/admin/links','PATCH',{slug,disabled:false})).r.status,200);
 assert.equal((await call('/api/report','POST',{slug,reason:'Disposable Neon end-to-end verification report.'})).r.status,201);
 assert.ok((await call('/api/admin/reports')).b.reports.some(x=>x.slug===slug));
 console.log('PASS expiration 410, unknown 404, admin session/list, disable/re-enable and abuse reports.');
 for(let i=0;i<20;i++)await call('/api/links','POST',{url:'https://example.com',alias:slug});
 assert.equal((await call('/api/links','POST',{url:'https://example.com',alias:slug})).r.status,429);
 const limits=await Promise.all(Array.from({length:12},()=>pool.query('select tereeza.consume_limit($1,5,3600) as allowed',[concurrencyKey])));
 assert.equal(limits.filter(x=>x.rows[0].allowed).length,5);
 console.log('PASS HTTP rate limit 429 and atomic concurrent database limit (5/12 admitted).');
 await call('/api/admin/session','DELETE');cookie='';assert.equal((await call('/api/admin/links')).r.status,401);
 assert.equal((await call('/manifest.webmanifest')).r.status,200);
 assert.equal((await call('/sw.js')).r.status,200);
 assert.ok(!/Click storage failed/.test(appLog),'Click persistence must not fail silently.');
 console.log('PASS logout, PWA manifest and service worker.');
 console.log('PASS ALL: production app → '+(local?'local':'Neon')+' PostgreSQL → redirects, analytics, moderation, reports and limits.');
}catch(e){console.error('E2E FAILED:',e.message||e.code||e.name, e.errors?.map(x=>x.code).join(',')||'');process.exitCode=1;}
finally{
 if(app){app.kill('SIGTERM');await new Promise(resolve=>{if(app.exitCode!==null)return resolve();app.once('exit',resolve);setTimeout(()=>{app.kill('SIGKILL');resolve()},3000).unref()});}
 try{
  await pool.query('delete from tereeza.reports where slug=$1',[slug]);
  await pool.query('delete from tereeza.links where slug=any($1::text[])',[[slug,expired]]);
  await pool.query('delete from tereeza.rate_limits where key=any($1::text[])',[[...limitKeys,concurrencyKey]]);
  console.log('Cleaned up only this run’s disposable test records.');
 }catch{console.error('Test record cleanup failed; inspect aliases beginning '+slug);process.exitCode=1;}
 await pool.end();
}
