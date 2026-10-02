/**
 * Page 3 — connect one app (opened from Page 2's checklist, route /connect/:service).
 *
 * Doc: selecting an app opens that app/website so the user can connect their
 * account; once connected, go back to Page 2 to connect the next one.
 *
 * In this prototype the provider's page is SIMULATED: a sheet in Wayfare's own
 * neutral styling (never imitating Instagram, Facebook, TikTok, or Google),
 * labeled "Simulated authorization", with no password fields. Steps:
 *
 *   consent → connecting → success   (Allow)
 *                        → failed    (Prototype "fail next connection" / demo link) → Try again
 *   consent → canceled               (Cancel → Page 2 with a note)
 *
 * Forced states (?s=): connecting · success · failed. `?return=<path>` sends
 * the user back to another page (e.g. Budget) instead of the checklist.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, Check, Circle, Compass, Info, Loader2, Lock, RotateCw, ShieldCheck, X } from 'lucide-react';
import type { ServiceId } from '../../data/types';
import { getService, type ServiceInfo } from '../../data/services';
import { disconnectService, setConnectionResult, setDemo } from '../../store/actions';
import { currentAccount } from '../../store/selectors';
import { getState, useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { simulateLatency } from '../../services/http';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/Display';
import { Switch } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Overlay';
import { isConnected, markJustChanged, safeReturnPath } from '../p02/connectHelpers';
import { ServiceTile } from '../p02/ServiceTile';
import './p03.css';

type Step = 'consent' | 'connecting' | 'success' | 'failed';

/** How long the simulated provider takes to answer (the forced state lingers so it can be reviewed). */
const CONNECT_MS = 1200;
const FORCED_CONNECT_MS = 3500;

/** Forced "success" grants everything except the last optional permission, so "Still off" has an example. */
function sampleGrant(info: ServiceInfo): string[] {
  const required = info.permissions.filter((p) => p.required).map((p) => p.key);
  const optional = info.permissions.filter((p) => !p.required).map((p) => p.key);
  return [...required, ...optional.slice(0, Math.max(0, optional.length - 1))];
}

/** The Page 3 sheet for one service. Rendered by ConnectPage on /connect/:service. */
export function ConnectFlow({ service, query }: { service: ServiceId; query: URLSearchParams }) {
  const state = useAppState();
  const account = currentAccount(state);
  const info = getService(service);
  const conn = account?.connections.find((c) => c.service === service);
  const forced = query.get('s');
  const hasAuthParam = query.has('auth');
  const returnTo = safeReturnPath(query.get('return'));

  // Was this service already connected when the flow opened? Then this is "Add permission".
  const [updating] = useState(() => isConnected(conn));
  const [missingAtStart] = useState(() => (isConnected(conn) ? (conn?.permissions.filter((p) => !p.granted).length ?? 0) : 0));
  const [step, setStep] = useState<Step>(() => (forced === 'connecting' || forced === 'success' || forced === 'failed' ? forced : 'consent'));
  // Every permission starts switched on; required ones can't be switched off.
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(info.permissions.map((p) => [p.key, true])));

  // `attempt` lets a newer attempt (or closing the sheet) cancel an older one still waiting.
  const attempt = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const chosenKeys = () => info.permissions.filter((p) => p.required || choices[p.key]).map((p) => p.key);

  /** Simulate the provider round trip, then record the result. */
  async function connect(keys: string[], ms = CONNECT_MS) {
    const id = ++attempt.current;
    setStep('connecting');
    await simulateLatency(ms);
    if (!alive.current || id !== attempt.current) return;
    if (getState().demo.failNextConnect) {
      setConnectionResult(service, 'failed'); // also clears the "fail next" flag
      setStep('failed');
      return;
    }
    setConnectionResult(service, 'success', keys);
    setStep('success');
  }

  // Forced states from the screen index (after App.tsx has applied ?auth=).
  useEffect(() => {
    if (hasAuthParam) return;
    const current = currentAccount(getState())?.connections.find((c) => c.service === service);
    if (forced === 'connecting') {
      void connect(info.permissions.map((p) => p.key), FORCED_CONNECT_MS);
    } else if (forced === 'success' && !isConnected(current)) {
      setConnectionResult(service, 'success', sampleGrant(info));
    } else if (forced === 'failed' && !isConnected(current)) {
      setConnectionResult(service, 'failed');
    }
    return () => {
      attempt.current += 1; // cancel a forced attempt if this effect re-runs
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAuthParam]);

  const backPath = returnTo ?? paths.connect();

  /** Cancel on the consent screen: nothing is shared; Page 2 explains why. */
  function cancel() {
    attempt.current += 1;
    if (updating) {
      toast({ title: `${info.name} permissions unchanged`, tone: 'info' });
      navigate(backPath, { replace: true });
      return;
    }
    // A failed row goes back to "Not connected" once the retry is canceled.
    if (conn?.status === 'failed') disconnectService(service);
    setConnectionResult(service, 'canceled');
    if (returnTo) {
      toast({ title: `${info.name} isn’t connected`, body: 'You canceled, so nothing was shared.', tone: 'info' });
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(withQuery(paths.connect(), { s: 'canceled', svc: service }), { replace: true });
  }

  function finishSuccess() {
    markJustChanged(service); // Page 2 highlights this row
    toast({ title: updating ? `${info.name} permissions updated` : `${info.name} connected`, tone: 'success' });
    navigate(backPath, { replace: true });
  }

  function leaveFailed() {
    markJustChanged(service);
    navigate(backPath, { replace: true });
  }

  /** Close button, Escape, or backdrop: means something different on each step. */
  function onSheetClose() {
    if (step === 'success') finishSuccess();
    else if (step === 'failed') leaveFailed();
    else cancel();
  }

  if (!account) return null;

  const footers: Record<Step, ReactNode> = {
    consent: (
      <>
        <Button variant="secondary" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={() => void connect(chosenKeys())} data-autofocus>
          Allow
        </Button>
      </>
    ),
    connecting: (
      <Button variant="secondary" onClick={cancel}>
        Cancel
      </Button>
    ),
    success: (
      <Button onClick={finishSuccess} data-autofocus>
        {returnTo ? 'Done' : 'Back to your checklist'}
      </Button>
    ),
    failed: (
      <>
        <Button variant="secondary" onClick={leaveFailed}>
          {returnTo ? 'Back' : 'Back to checklist'}
        </Button>
        <Button icon={<RotateCw />} onClick={() => void connect(chosenKeys())} data-autofocus>
          Try again
        </Button>
      </>
    ),
  };

  return (
    <Sheet
      open
      onClose={onSheetClose}
      title={!updating ? `Connect ${info.name}` : missingAtStart > 0 ? `Add ${info.name} permissions` : `Change ${info.name} permissions`}
      size="md"
      fullOnMobile
      className={`p03-sheet is-${step}`}
      footer={footers[step]}
    >
      {step === 'consent' && (
        <Consent
          info={info}
          email={account.email}
          choices={choices}
          onToggle={(key, on) => setChoices((prev) => ({ ...prev, [key]: on }))}
          failNext={state.demo.failNextConnect}
          updating={updating}
          grantedNow={conn?.permissions.filter((p) => p.granted).map((p) => p.key) ?? []}
        />
      )}

      {step === 'connecting' && (
        <div className="p03-status" role="status" aria-live="polite">
          <span className="p03-status-icon is-busy" aria-hidden>
            <Loader2 className="spin" />
          </span>
          <p className="p03-status-title">Connecting to {info.name}…</p>
          <p className="p03-status-text">Waiting for {info.name} to confirm. This usually takes a few seconds.</p>
        </div>
      )}

      {step === 'success' && <Success info={info} granted={conn?.permissions.filter((p) => p.granted).map((p) => p.key) ?? []} updating={updating} />}

      {step === 'failed' && (
        <div className="stack-md">
          <div className="p03-status" role="alert">
            <span className="p03-status-icon is-failed" aria-hidden>
              <X />
            </span>
            <p className="p03-status-title">Couldn’t connect to {info.name}</p>
            <p className="p03-status-text">The service didn’t respond. Try again or skip it for now.</p>
          </div>
          <p className="p03-demo-note">
            <DemoBadge>Demo</DemoBadge>
            <span>This error was simulated. Nothing was shared with Wayfare.</span>
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------- consent step */

/** "Wayfare would like to:" — one switch per permission; required ones are locked on. */
function Consent({
  info,
  email,
  choices,
  onToggle,
  failNext,
  updating,
  grantedNow,
}: {
  info: ServiceInfo;
  email: string;
  choices: Record<string, boolean>;
  onToggle: (key: string, on: boolean) => void;
  failNext: boolean;
  updating: boolean;
  grantedNow: string[];
}) {
  return (
    <div className="p03-consent">
      <div className="p03-sim">
        <DemoBadge>Simulated authorization</DemoBadge>
        <p>In the real app this step happens on {info.name}’s own site.</p>
      </div>

      <div className="p03-handshake" aria-hidden>
        <span className="p03-app-tile">
          <Compass />
        </span>
        <span className="p03-handshake-line">
          <ArrowLeftRight />
        </span>
        <ServiceTile service={info.id} size={48} />
      </div>

      <div className="p03-ask">
        <h3 className="p03-ask-title">Wayfare would like to:</h3>
        <p className="p03-signed">
          Signed in to {info.name} as <strong>{email}</strong>
        </p>
      </div>

      <ul className="p03-perms" aria-label="Permissions Wayfare is asking for">
        {info.permissions.map((p) => (
          <li key={p.key} className={`p03-perm ${p.required ? 'is-required' : ''}`}>
            <Switch
              label={p.label}
              checked={p.required || !!choices[p.key]}
              disabled={p.required}
              onChange={(on) => onToggle(p.key, on)}
              description={
                <>
                  <span className="p03-unlocks">{p.unlocks}</span>
                  {p.required ? (
                    <span className="p03-lock">
                      <Lock aria-hidden />
                      Required to connect. Wayfare can’t link your account without it.
                    </span>
                  ) : updating && !grantedNow.includes(p.key) ? (
                    <span className="p03-new">Not granted yet</span>
                  ) : null}
                </>
              }
            />
          </li>
        ))}
      </ul>

      {info.note && (
        <p className="p03-note">
          <Info aria-hidden />
          <span>{info.note}</span>
        </p>
      )}

      <p className="p03-fine">
        <ShieldCheck aria-hidden />
        <span>Wayfare never posts for you. You can change this anytime from your checklist.</span>
      </p>

      <p className="p03-demo-fail">
        {failNext ? (
          <>
            <span>Demo: the next attempt will fail once.</span>
            <button type="button" className="p03-link-btn" onClick={() => setDemo({ failNextConnect: false })}>
              Undo
            </button>
          </>
        ) : (
          <button type="button" className="p03-link-btn" onClick={() => setDemo({ failNextConnect: true })}>
            Demo: simulate an error
          </button>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- success step */

/** Confirmation that lists exactly what was granted and what is still off. */
function Success({ info, granted, updating }: { info: ServiceInfo; granted: string[]; updating: boolean }) {
  const on = info.permissions.filter((p) => granted.includes(p.key));
  const off = info.permissions.filter((p) => !granted.includes(p.key));
  return (
    <div className="stack-lg">
      <div className="p03-status" role="status">
        <span className="p03-status-icon is-success" aria-hidden>
          <Check />
        </span>
        <p className="p03-status-title">{updating ? `${info.name} permissions updated` : `${info.name} connected`}</p>
        <p className="p03-status-text">Here’s exactly what Wayfare can see.</p>
      </div>

      <section className="p03-summary" aria-labelledby="p03-granted">
        <h3 id="p03-granted" className="p03-summary-title">
          Granted
        </h3>
        <ul className="p03-summary-list">
          {on.map((p) => (
            <li key={p.key} className="is-on">
              <Check aria-hidden />
              <span>
                {p.label}
                <span className="p03-summary-unlocks">{p.unlocks}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {off.length > 0 && (
        <section className="p03-summary" aria-labelledby="p03-off">
          <h3 id="p03-off" className="p03-summary-title">
            Still off
          </h3>
          <ul className="p03-summary-list">
            {off.map((p) => (
              <li key={p.key}>
                <Circle aria-hidden />
                <span>
                  {p.label}
                  <span className="p03-summary-unlocks">{p.unlocks}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="p03-summary-hint">You can turn {off.length === 1 ? 'it' : 'these'} on later with “Add permission” on your checklist.</p>
        </section>
      )}
    </div>
  );
}
