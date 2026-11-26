
import { after } from 'next/server';

import { hash, failure } from '@/lib/server';
import { findLink, recordClick } from '@/lib/database';
import { alias, AppError, destination } from '@/lib/validation';
import {
  clickDetails,
  isTrackableVisit,
} from '@/lib/click-tracking';

export const dynamic = 'force-dynamic';

async function redirect(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
  track: boolean
) {
  try {
    const slug = alias((await ctx.params).slug);
    const data = await findLink(slug);

    if (!data) {
      throw new AppError('Link not found.', 404);
    }

    if (
      data.disabled ||
      (data.expires_at &&
        Date.parse(data.expires_at) <= Date.now())
    ) {
      throw new AppError(
        'This link is no longer available.',
        410
      );
    }

    const url = destination(data.url);

    // Record clicks asynchronously without delaying redirects.
    if (track) {
      after(async () => {
        try {
          // Exclude bots, crawlers and preview requests.
          if (!isTrackableVisit(req.headers)) {
            return;
          }

          // Prepare visitor hash, referrer and device details.
          const { visitor, referrer, device } = clickDetails(
            req.headers,
            hash
          );

          // Store the visit in the database.
          await recordClick(
            data.id,
            visitor,
            referrer,
            device
          );
        } catch {
          console.error('Click storage failed');
        }
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    return failure(e);
  }
}

export const GET = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) => redirect(req, ctx, true);

export const HEAD = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) => redirect(req, ctx, false);
