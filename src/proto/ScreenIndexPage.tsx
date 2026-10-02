/**
 * Prototype tool: every page and state, each with a deep link that reproduces
 * it, plus a phone-sized preview (390 × 844) for reviewers on a desktop.
 */

import { useMemo, useState } from 'react';
import { ExternalLink, FileCheck2, Images, Smartphone } from 'lucide-react';
import { APP_NAME, APP_NAME_NOTE } from '../config';
import { addDays } from '../lib/dates';
import { MAYA_PERSON_ID, sampleTripId } from '../data/seed';
import { getState } from '../store/store';
import { Link } from '../router/router';
import { paths } from '../router/routes';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge, Banner } from '../components/ui/Display';
import { Sheet } from '../components/ui/Overlay';
import { ALL_SCREENS, PAGE_NAMES, type ScreenEntry } from './screens';
import './proto.css';

/** Build the in-app URL (hash path + params) for a screen entry. */
export function screenHref(entry: ScreenEntry): string {
  const s = getState();
  const tripId = sampleTripId(MAYA_PERSON_ID);
  const trip = s.trips.find((t) => t.id === tripId);
  const start = trip?.startDate ?? addDays(s.seededOn, 14);
  const raw = typeof entry.path === 'function' ? entry.path({ sampleTripId: tripId, day: (n) => addDays(start, n - 1) }) : entry.path;
  const [path, qs = ''] = raw.split('?');
  const q = new URLSearchParams(qs);
  if (entry.auth && entry.auth !== 'none') q.set('auth', entry.auth);
  q.set('as', entry.as ?? 'owner');
  q.set('date', entry.date ?? 'real');
  if (entry.nearby) q.set('nearby', '1');
  return `${path}?${q.toString()}`;
}

export function ScreenIndexPage() {
  const [preview, setPreview] = useState<ScreenEntry | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<number, ScreenEntry[]>();
    for (const e of ALL_SCREENS) map.set(e.page, [...(map.get(e.page) ?? []), e]);
    return map;
  }, []);
  const pages = Array.from({ length: 17 }, (_, i) => i + 1);
  const base = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="container page proto-page">
      <PageHeader
        eyebrow="Prototype tools"
        title="Screen index"
        subtitle={`Every page of ${APP_NAME} (${APP_NAME_NOTE.toLowerCase()}) and its important states. Each link reproduces the state: it signs in a demo account, sets the role, and sets the demo clock.`}
        actions={
          <>
            <Button to={paths.protoChecklist()} variant="secondary" icon={<FileCheck2 />}>
              Requirement checklist
            </Button>
            <Button to={paths.protoCredits()} variant="ghost" icon={<Images />}>
              Credits
            </Button>
          </>
        }
      />
      <Banner tone="demo" title="Links change the demo session">
        Most links sign you in as Maya Chen (the returning demo user). “New user” links create a fresh demo account. Use “Phone preview” to see the 390px layout on a desktop.
      </Banner>
      <div className="stack-xl proto-pages">
        {pages.map((n) => {
          const entries = grouped.get(n) ?? [];
          return (
            <section key={n} className="proto-group" aria-labelledby={`pg-${n}`}>
              <h2 id={`pg-${n}`} className="proto-group-title">
                <span className="proto-page-no num">{n}</span>
                {PAGE_NAMES[n]}
              </h2>
              {n === 14 ? (
                <p className="muted">The source document jumps from Page 13 to Page 15. The number is kept as-is; nothing was invented for it.</p>
              ) : (
                <ul className="proto-list">
                  {entries.map((e) => (
                    <li key={e.id} className="proto-row">
                      <span className="proto-id num">{e.id}</span>
                      <span className="proto-title">
                        {e.title}
                        <span className="proto-tags">
                          {e.auth === 'new' && <Badge>New user</Badge>}
                          {e.as && e.as !== 'owner' && <Badge tone="info">as {e.as === 'day' ? 'day editor' : e.as}</Badge>}
                          {e.date && e.date !== 'real' && <Badge tone="accent">{e.date} trip</Badge>}
                          {e.overlay && <Badge tone="neutral">overlay</Badge>}
                        </span>
                      </span>
                      <span className="proto-actions">
                        <Link to={screenHref(e)} className="btn btn-secondary btn-sm">
                          Open
                        </Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(e)}>
                          <Smartphone className="btn-icon" aria-hidden /> Phone preview
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.id} · ${preview.title}` : ''} description="390 × 844 phone preview. It shares this browser’s demo data." size="lg">
        {preview && (
          <div className="phone-preview-wrap">
            <iframe key={preview.id} title={`Phone preview of ${preview.title}`} className="phone-preview" src={`${base}#${screenHref(preview)}`} />
            <a className="small" href={`${base}#${screenHref(preview)}`} target="_blank" rel="noreferrer">
              Open in a new tab <ExternalLink width={14} aria-hidden />
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}
