/**
 * The app's wordmark (compass in a teal rounded square + the product name),
 * matching the one in the signed-in header. Pages 1–3 render without the app
 * shell, so they draw their own. Reuses the global `.wordmark` classes from
 * shell.css so all wordmarks stay identical.
 */

import { Compass } from 'lucide-react';
import { APP_NAME } from '../../config';
import { Link } from '../../router/router';
import './p01.css';

export function Wordmark({ tone = 'ink', to, className = '' }: {
  /** 'ink' on normal backgrounds, 'light' on top of a photo. */
  tone?: 'ink' | 'light';
  /** Optional in-app link target (e.g. Home). */
  to?: string;
  className?: string;
}) {
  const classes = `wordmark ${tone === 'light' ? 'p01-wordmark-light' : ''} ${className}`;
  const content = (
    <>
      <span className="wordmark-mark" aria-hidden>
        <Compass />
      </span>
      <span className="wordmark-text">{APP_NAME}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`${APP_NAME} home`}>
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
