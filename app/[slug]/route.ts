import {after} from 'next/server';
import {hash,failure} from '@/lib/server';
import {findLink,recordClick} from '@/lib/database';
import {alias,AppError,destination} from '@/lib/validation';
export const dynamic='force-dynamic';
async function redirect(req:Request,ctx:{params:Promise<{slug:string}>},track:boolean){try{const slug=alias((await ctx.params).slug);const data=await findLink(slug);if(!data)throw new AppError('Link not found.',404);if(data.disabled||data.expires_at&&Date.parse(data.expires_at)<=Date.now())throw new AppError('This link is no longer available.',410);const url=destination(data.url);
 if(track)after(async()=>{try{const ua=req.headers.get('user-agent')||'';if(/bot|crawler|spider|preview/i.test(ua))return;let ref='direct';try{ref=new URL(req.headers.get('referer')||'').hostname}catch{}const ip=process.env.VERCEL?req.headers.get('x-vercel-forwarded-for')||'unknown':'local';await recordClick(data.id,hash(new Date().toISOString().slice(0,10)+ip),ref.slice(0,253),/mobile|android|iphone/i.test(ua)?'mobile':'desktop')}catch{console.error('Click storage failed')}});
 return new Response(null,{status:302,headers:{Location:url,'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})}catch(e){return failure(e)}}
export const GET=(r:Request,c:{params:Promise<{slug:string}>})=>redirect(r,c,true);
export const HEAD=(r:Request,c:{params:Promise<{slug:string}>})=>redirect(r,c,false);
