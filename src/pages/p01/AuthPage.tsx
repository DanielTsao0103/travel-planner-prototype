/** Page 1 — Log in / Create account — placeholder (replaced during the page build). */

import { PageHeader } from '../../components/layout/PageHeader';

export function AuthPage(_props: { mode: 'login' | 'signup'; query: URLSearchParams }) {
  return (
    <div className="container page">
      <PageHeader title="Page 1 — Log in / Create account" subtitle="Not built yet." />
    </div>
  );
}
