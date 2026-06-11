import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function SymphonyLink({ to, children, className, onClick, ...props }) {
  const content = (
    <>
      <span className="symphony-link-chevron" aria-hidden="true">
        ›
      </span>
      {children}
    </>
  );

  const classes = cn('symphony-link', className);

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} {...props}>
      {content}
    </button>
  );
}
