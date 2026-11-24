import 'server-only';
import {consumeLimit} from './database';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {AppError} from './validation';
export function env(k:string){const v=process.env[k];if(!v)throw new AppError('Service configuration is incomplete.',503);return v}
export const site=()=>process.env.SITE_URL||'http://localhost:3000';
export const token=()=>randomBytes(24).toString('hex');
export const hash=(s:string)=>createHmac('sha256',env('IP_HASH_SECRET')).update(s).digest('hex');
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function origin(req:Request){if(req.headers.get('origin')!==new URL(site()).origin)throw new AppError('Request origin is not allowed.',403)}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>8192)throw new AppError('Request too large.',413);const t=await req.text();if(Buffer.byteLength(t)>8192)throw new AppError('Request too large.',413);try{const data=JSON.parse(t);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data}catch{throw new AppError('Invalid JSON object.')}}
export async function limit(req:Request,scope:string,max:number,seconds=3600){
 // Only trust Vercel's overwritten client-IP header in production. Local development shares a bucket.
 const ip=process.env.VERCEL?req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown':'local';
 let allowed:boolean;try{allowed=await consumeLimit(hash(scope+ip),max,seconds)}catch{throw new AppError('Rate limiting unavailable. Try later.',503)}if(!allowed)throw new AppError('Too many requests. Try again later.',429);
}
export function failure(e:unknown){const status=e instanceof AppError?e.status:503;return Response.json({error:e instanceof AppError?e.message:'Service temporarily unavailable.'},{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'3600'}:{})}})}
function signature(s:string){return createHmac('sha256',env('SESSION_SECRET')).update(s).digest('hex')}
export function session(){const s=String(Date.now()+8*3600000);return s+'.'+signature(s)}
export async function admin(){const v=(await cookies()).get('tereeza-admin')?.value||'';const [exp,sig]=v.split('.');if(!exp||!sig||!equal(sig,signature(exp))||!/^\d+$/.test(exp)||Number(exp)<Date.now())throw new AppError('Admin sign-in required.',401)}
export async function threat(url:string){const key=process.env.WEB_RISK_API_KEY;if(!key){if(process.env.REQUIRE_THREAT_CHECK==='true')throw new AppError('Threat screening unavailable.',503);return}
 const q=new URLSearchParams({key,uri:url});for(const t of ['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE'])q.append('threatTypes',t);
 const r=await fetch('https://webrisk.googleapis.com/v1/uris:search?'+q,{signal:AbortSignal.timeout(5000),cache:'no-store'});if(!r.ok)throw new AppError('Threat screening unavailable.',503);if((await r.json()).threat)throw new AppError('This URL was flagged as unsafe.',422);
}
