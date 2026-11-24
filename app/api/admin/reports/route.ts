import {admin,failure} from '@/lib/server';import {listReports} from '@/lib/database';
export async function GET(){try{await admin();return Response.json({reports:await listReports()},
  {headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
