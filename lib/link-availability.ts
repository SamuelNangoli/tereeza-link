
import { AppError } from './validation';

type LinkAvailability = {
  disabled: boolean;
  expires_at: string | null;
};

export function assertLinkAvailable(
  link: LinkAvailability | null | undefined,
  now = Date.now()
): asserts link is LinkAvailability {
  if (!link) {
    throw new AppError('Link not found.', 404);
  }

  if (
    link.disabled ||
    (link.expires_at &&
      Date.parse(link.expires_at) <= now)
  ) {
    throw new AppError(
      'This link is no longer available.',
      410
    );
  }
}
