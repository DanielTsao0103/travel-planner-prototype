/**
 * Page 2 — Connect your accounts (shown right after creating an account).
 *
 * Doc: a checklist of apps to link (Instagram, Facebook, TikTok, Gmail) that
 * says what we'd have access to, plus a Skip option that warns about every
 * feature they'd miss. Selecting an app opens Page 3 (the simulated
 * authorization), which comes back here with the checklist updated.
 *
 * Layout: desktop has the checklist on the left and a sticky "What you get"
 * card (with Continue / Skip) on the right. Tablets and phones get one column
 * and a sticky action bar; phones also get stacked rows with accordion details.
 *
 * The same page doubles as "Connected accounts" for people who already
 * finished onboarding (the main button then reads "Done").
 *
 * Forced states (?s=): partial · all · skip · canceled (&svc=<service>)
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, FlaskConical, ShieldCheck, X } from 'lucide-react';
import type { Account, Connection, ServiceId } from '../../data/types';
import { getService, SERVICES, type ServiceInfo } from '../../data/services';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { disconnectService, finishOnboarding, setConnectionResult } from '../../store/actions';
import { currentAccount } from '../../store/selectors';
import { getState, useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { Link, navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { Button, IconButton } from '../../components/ui/Button';
import { Banner } from '../../components/ui/Display';
import { PrototypeDrawer } from '../../components/layout/PrototypeDrawer';
import { Wordmark } from '../p01/Wordmark';
import { ConnectFlow } from '../p03/ConnectFlow';
import { asServiceId, isConnected, rowStatus, safeReturnPath, serviceFeatures, wasJustChanged } from './connectHelpers';
import { ServiceRow } from './ServiceRow';
import { ServiceTile } from './ServiceTile';
import { SkipSheet } from './SkipSheet';
import './p02.css';

/** Forced states that show the onboarding version even for an onboarded account. */
const ONBOARDING_STATES = new Set(['partial', 'all', 'skip']);

/** Apply the screen-index forced states that need data (2B partial, 2C all). */
function applyForcedState(s: string | null, account: Account) {
  const conn = (id: ServiceId) => account.connections.find((c) => c.service === id);
  if (s === 'partial') {
    if (!isConnected(conn('instagram'))) setConnectionResult('instagram', 'success', ['profile', 'saved']);
    if (!isConnected(conn('gmail'))) setConnectionResult('gmail', 'success', ['receipts']);
  }
  if (s === 'all') {
    for (const info of SERVICES) {
      if (rowStatus(conn(info.id)) !== 'connected') setConnectionResult(info.id, 'success', info.permissions.map((p) => p.key));
    }
  }
}

export function ConnectPage({ service, query }: { service?: string; query: URLSearchParams }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const account = currentAccount(state);
  const s = query.get('s');
  const hasAuthParam = query.has('auth');
  const serviceId = asServiceId(service);
  const returnTo = safeReturnPath(query.get('return'));
  const [skipOpen, setSkipOpen] = useState(s === 'skip');
  const [protoOpen, setProtoOpen] = useState(false);

  // Forced data states. Wait until App.tsx has applied `?auth=` (it signs in a
  // fresh demo account), so the change lands on the right account.
  useEffect(() => {
    const acct = currentAccount(getState());
    if (hasAuthParam || !acct) return;
    applyForcedState(s, acct);
  }, [s, hasAuthParam, account?.id]);

  // /connect/<something we don't support> → back to the checklist.
  useEffect(() => {
    if (service && !serviceId) {
      toast({ title: 'That app can’t be connected', body: 'Choose Instagram, Facebook, TikTok, or Gmail.', tone: 'info' });
      navigate(paths.connect(), { replace: true });
    }
  }, [service, serviceId]);

  if (!account) return null; // App.tsx sends signed-out visitors to Log in.

  const manage = account.onboardingDone && !ONBOARDING_STATES.has(s ?? '');
  const rows = SERVICES.map((info) => ({ info, conn: account.connections.find((c) => c.service === info.id) }));
  const connectedCount = rows.filter((r) => isConnected(r.conn)).length;
  const allConnected = connectedCount === rows.length;
  const unconnected = rows.filter((r) => !isConnected(r.conn)).map((r) => r.info);
  const googleSignIn = account.providers.includes('google');
  const canceledInfo = s === 'canceled' ? (asServiceId(query.get('svc')) ? getService(asServiceId(query.get('svc'))!) : null) : undefined;

  /** Leave Page 2 for Home (or wherever we were sent from). */
  function leave() {
    if (!account?.onboardingDone) finishOnboarding();
    navigate(returnTo ?? paths.home());
  }

  /** "Continue": with nothing connected yet, show the skip warning instead. */
  function onContinue() {
    if (!manage && connectedCount === 0) {
      setSkipOpen(true);
      return;
    }
    leave();
  }

  function disconnect(id: ServiceId) {
    const info = getService(id);
    const before = account?.connections.find((c) => c.service === id);
    const grantedKeys = before?.permissions.filter((p) => p.granted).map((p) => p.key) ?? [];
    disconnectService(id);
    toast({
      title: `${info.name} disconnected`,
      body: 'Wayfare can no longer see anything from it.',
      tone: 'info',
      action: { label: 'Undo', onClick: () => setConnectionResult(id, 'success', grantedKeys) },
    });
  }

  const dismissNote = () => navigate(paths.connect(), { replace: true });

  // Tablet/desktop page actions (phones use the sticky bar at the bottom instead).
  const wideBlock = bp === 'desktop';
  const actions =
    manage || !allConnected ? (
      <div className={`p02-actions ${wideBlock ? 'is-stacked' : ''}`}>
        {manage ? (
          <Button size="lg" block={wideBlock} onClick={leave}>
            Done
          </Button>
        ) : (
          <>
            <Button size="lg" block={wideBlock} onClick={onContinue} iconRight={<ArrowRight />}>
              Continue
            </Button>
            <Button size="lg" block={wideBlock} variant="ghost" onClick={() => setSkipOpen(true)}>
              Skip for now
            </Button>
            <p className="p02-actions-hint">{connectedCount === 0 ? 'Nothing is shared until you connect an account.' : 'You can connect the others later.'}</p>
          </>
        )}
      </div>
    ) : null;

  return (
    <div className={`p02 ${manage ? 'is-manage' : ''}`}>
      <header className="p02-top">
        <div className="p02-top-inner">
          <Wordmark to={manage ? paths.home() : undefined} />
          <div className="grow" />
          {bp !== 'mobile' && <span className="p02-who">Signed in as {account.email}</span>}
          {bp !== 'mobile' && (
            <button type="button" className="proto-pill" onClick={() => setProtoOpen(true)}>
              <FlaskConical aria-hidden />
              Prototype
            </button>
          )}
          {bp === 'mobile' && !manage && <span className="p02-step-pill">Step 2 of 2</span>}
        </div>
      </header>

      <main className="p02-main" id="main">
        <div className="p02-layout">
          <div className="p02-primary">
            <header className="p02-head">
              {manage ? (
                <Link to={returnTo ?? paths.home()} className="back-link">
                  <ChevronLeft aria-hidden />
                  {returnTo ? 'Back' : 'Home'}
                </Link>
              ) : (
                <p className="p02-eyebrow">
                  <span className="p02-created">
                    <CheckCircle2 aria-hidden />
                    Account created
                  </span>
                  {bp !== 'mobile' && (
                    <span className="p02-step">
                      <span className="p02-step-bars" aria-hidden>
                        <span />
                        <span />
                      </span>
                      Step 2 of 2
                    </span>
                  )}
                </p>
              )}
              <h1 className="p02-title">{manage ? 'Connected accounts' : 'Connect your accounts'}</h1>
              <p className="p02-lede">Bring travel ideas, friends, and receipts into one place. You choose exactly what we can see.</p>
            </header>

            {allConnected && (
              <Banner
                tone="success"
                title="All four accounts connected"
                action={bp === 'desktop' && !manage ? <Button onClick={leave} iconRight={<ArrowRight />}>Continue to Home</Button> : undefined}
              >
                Saved ideas, friends, events, and receipts can now flow into your trips.
              </Banner>
            )}

            {canceledInfo !== undefined && (
              <Banner
                tone="info"
                className="p02-note-banner"
                title={canceledInfo ? `${canceledInfo.name} isn’t connected because you canceled.` : 'Nothing was connected because you canceled.'}
                action={
                  <div className="p02-note-actions">
                    {canceledInfo && !isConnected(account.connections.find((c) => c.service === canceledInfo.id)) && (
                      <Button size="sm" variant="secondary" to={paths.connectService(canceledInfo.id)}>
                        Connect {canceledInfo.name}
                      </Button>
                    )}
                    <IconButton label="Dismiss" icon={<X />} size="sm" onClick={dismissNote} />
                  </div>
                }
              >
                {canceledInfo ? 'You can connect it anytime.' : 'You can connect any of these anytime.'}
              </Banner>
            )}

            <section className="p02-checklist" aria-labelledby="p02-list-title">
              <div className="p02-list-head">
                <h2 id="p02-list-title" className="p02-list-title">
                  {manage ? 'Your apps' : 'Apps to connect'}
                </h2>
                <span className="p02-count">
                  <span className="num">
                    {connectedCount} of {rows.length} connected
                  </span>
                  {/* Progress fills from the left, one segment per connected app. */}
                  <span className="p02-meter" aria-hidden>
                    {rows.map((r, i) => (
                      <span key={r.info.id} className={i < connectedCount ? 'is-on' : ''} />
                    ))}
                  </span>
                </span>
              </div>
              <ul className="p02-list">
                {rows.map(({ info, conn }) => (
                  <ServiceRow
                    key={info.id}
                    info={info}
                    conn={conn}
                    googleSignIn={googleSignIn}
                    compact={bp === 'mobile'}
                    // Desktop opens rows that still need a permission so it's clear which one.
                    defaultOpen={bp === 'desktop' && rowStatus(conn) === 'needs-permission'}
                    highlight={!serviceId && wasJustChanged(info.id)}
                    onDisconnect={() => disconnect(info.id)}
                  />
                ))}
              </ul>
            </section>

            {bp === 'mobile' && (
              <p className="p02-privacy">
                <ShieldCheck aria-hidden />
                <span>We only read what you allow. We never post for you.</span>
              </p>
            )}

          </div>

          {bp !== 'mobile' && (
            <aside className="p02-aside" aria-labelledby="p02-get-title">
              {/* Desktop keeps Continue / Skip in this sticky card so they're always in view. */}
              <WhatYouGet rows={rows}>{bp === 'desktop' ? actions : null}</WhatYouGet>
            </aside>
          )}
        </div>
      </main>

      {/* Phones and tablets: a sticky action bar so Continue is always in reach. */}
      {bp !== 'desktop' && (
        <div className="p02-bar">
          <div className="p02-bar-inner">
            {manage ? (
              <Button className="p02-bar-main" onClick={leave}>
                Done
              </Button>
            ) : allConnected ? (
              <Button className="p02-bar-main" onClick={leave} iconRight={<ArrowRight />}>
                Continue to Home
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setSkipOpen(true)}>
                  Skip for now
                </Button>
                <Button className="p02-bar-main" onClick={onContinue} iconRight={<ArrowRight />}>
                  Continue
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <SkipSheet
        open={skipOpen && unconnected.length > 0}
        onClose={() => setSkipOpen(false)}
        onSkip={() => {
          setSkipOpen(false);
          leave();
        }}
        unconnected={unconnected}
      />

      {/* Keyed by account too, so a demo-account switch (screen index links) starts a fresh flow. */}
      {serviceId && <ConnectFlow key={`${account.id}:${serviceId}`} service={serviceId} query={query} />}

      <PrototypeDrawer open={protoOpen} onClose={() => setProtoOpen(false)} />
    </div>
  );
}

/** Side panel: which features each connection turns on, the privacy promise, and (desktop) the page actions. */
function WhatYouGet({ rows, children }: { rows: Array<{ info: ServiceInfo; conn: Connection | undefined }>; children?: ReactNode }) {
  return (
    <div className="p02-get">
      <h2 id="p02-get-title" className="p02-get-title">
        What you get
      </h2>
      <ul className="p02-get-list">
        {rows.map(({ info, conn }) => {
          const features = serviceFeatures(info, conn);
          return (
            <li key={info.id} className="p02-get-svc">
              <div className="p02-get-head">
                <ServiceTile service={info.id} size={24} />
                <span className="p02-get-name">{info.name}</span>
                <span className={`p02-get-state ${isConnected(conn) ? 'is-on' : ''}`}>{isConnected(conn) ? 'Connected' : 'Not connected'}</span>
              </div>
              <ul className="p02-get-features">
                {features.map((f) => (
                  <li key={f.text} className={f.on ? 'is-on' : ''}>
                    <span className="p02-get-dot" aria-hidden />
                    <span>
                      {f.text}
                      <span className="sr-only">{f.on ? ' (on)' : ' (off)'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {children}
      <p className="p02-privacy">
        <ShieldCheck aria-hidden />
        <span>We only read what you allow. We never post for you.</span>
      </p>
    </div>
  );
}
