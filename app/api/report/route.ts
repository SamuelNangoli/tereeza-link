import {origin,body,limit,failure} from '@/lib/server';
import {addReport} from '@/lib/database';import {alias,AppError} from '@/lib/validation';
export async function POST(req:Request){try{
  origin(req);await limit(req,'report',5);const b=await body(req);const slug=alias(b.slug);
  if(typeof b.reason!=='string'||b.reason.trim().length<10||b.reason.length>1000)
    throw new AppError('Describe the issue in 10–1,000 characters.');
  await addReport(slug,b.reason);return Response.json({ok:true},{status:201});
}catch(e){return failure(e)}}
