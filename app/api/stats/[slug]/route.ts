import {hash,equal,admin,failure,limit} from '@/lib/server';
import {findLink,clickBreakdown} from '@/lib/database';
import {alias,AppError} from '@/lib/validation';
export async function GET(req:Request,ctx:{params:Promise<{slug:string}>}){try{
  await limit(req,'stats',120);const data=await findLink(alias((await ctx.params).slug));
  if(!data)throw new AppError('Link not found.',404);
  const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!supplied||!equal(hash(supplied),data.manage_hash))await admin();
  const clicks=await clickBreakdown(data.id);
  const {manage_hash:_,...link}=data;void _;
  return Response.json({link,clicks},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
