
import { after } from 'next/server';

import { assertLinkAvailable } from '@/lib/link-availability';
import { hash, failure } from '@/lib/server';
import { findLink, recordClick } from '@/lib/database';
import { alias, destination } from '@/lib/validation';
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
    // Validate the requested short-link alias.
    const slug = alias((await ctx.params).slug);

    // Retrieve the short link from the database.
    const data = await findLink(slug);

    // Reject missing, disabled or expired links.
    // Returns 404 for missing links and 410 for unavailable links.
    assertLinkAvailable(data);

    // Validate the destination URL.
    const url = destination(data.url);

    // Record eligible clicks asynchronously.
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

    // Redirect without caching the response.
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

// GET redirects and records eligible clicks.
export const GET = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) => redirect(req, ctx, true);

// HEAD redirects without recording clicks.
export const HEAD = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) => redirect(req, ctx, false);
