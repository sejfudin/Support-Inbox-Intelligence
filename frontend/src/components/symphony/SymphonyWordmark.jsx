import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/brand/symphony.png';

export function SymphonyWordmark({ className, linkTo = '/programme' }) {
  const image = (
    <img
      src={LOGO_SRC}
      alt="Symphony"
      className={cn('symphony-logo', className)}
      data-test="symphony-wordmark"
    />
  );

  if (!linkTo) {
    return image;
  }

  return (
    <Link
      to={linkTo}
      className="symphony-logo-link inline-flex shrink-0 items-center"
      data-test="symphony-wordmark-link"
      aria-label="Symphony — programme home"
    >
      {image}
    </Link>
  );
}
