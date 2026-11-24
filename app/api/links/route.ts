import {randomBytes} from 'node:crypto';
import {alias,destination,expiration,AppError} from '@/lib/validation';
import {origin,body,limit,failure,token,hash,site,threat} from '@/lib/server';
import {insertLink} from '@/lib/database';
export async function POST(req:Request){try{
  origin(req);await limit(req,'create',20);const b=await body(req);
  if(b.website)throw new AppError('Request rejected.');
  const url=destination(b.url),expires=expiration(b.expiresAt);await threat(url);
  const custom=b.alias?alias(b.alias):null,secret=token();
  for(let i=0;i<5;i++){
    const slug=custom||randomBytes(6).toString('base64url').toLowerCase();
    const data=await insertLink(slug,url,expires,hash(secret));
    if(data)return Response.json({slug:data.slug,shortUrl:site()+'/'+data.slug,manageToken:secret},
      {status:201,headers:{'Cache-Control':'no-store'}});
    if(custom)throw new AppError('That alias is already taken.',409);
  }
  throw new AppError('Please try again.',503);
}catch(e){return failure(e)}}
