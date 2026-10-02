/** Standard page title block with optional back link and actions. */

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from '../../router/router';
import '../domain/domain.css';

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back && (
        <Link to={back.to} className="back-link">
          <ChevronLeft aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="page-header-row">
        <div className="page-header-text">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p className="page-header-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
