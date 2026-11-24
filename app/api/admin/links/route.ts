import {admin,origin,body,failure} from '@/lib/server';
import {listLinks,setDisabled} from '@/lib/database';
import {alias,AppError} from '@/lib/validation';
export async function GET(req:Request){try{
  await admin();const u=new URL(req.url);
  const page=Math.floor(Math.max(0,Math.min(100000,Number(u.searchParams.get('page'))||0)));
  const search=u.searchParams.get('search');
  return Response.json({links:await listLinks(page,search?alias(search):null)},
    {headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
export async function PATCH(req:Request){try{
  origin(req);await admin();const b=await body(req);
  if(typeof b.disabled!=='boolean')throw new AppError('Invalid status.');
  if(!await setDisabled(alias(b.slug),b.disabled))throw new AppError('Link not found.',404);
  return Response.json({ok:true});
}catch(e){return failure(e)}}
