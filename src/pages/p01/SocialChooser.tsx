/**
 * Page 1 — the simulated "Continue with Google / Apple" step (screens 1E, 1F, 1I).
 *
 * A real app would send the user to Google's or Apple's own sign-in page. Here
 * a clearly labeled sheet stands in for it: pick one of two fictional accounts
 * (or type another email). There are no password fields anywhere.
 *
 * What happens next depends on the mode and on whether Wayfare knows the email:
 *  - Log in + known account   → signed in, go Home.
 *  - Log in + unknown account → "No Wayfare account for …" → Create an account (1F).
 *  - Sign up + new account    → confirm what's shared → Create account → Page 2.
 *  - Sign up + known account  → "You already have an account" → Log in instead (1I).
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { logInWithProvider, signUp } from '../../store/actions';
import { getState } from '../../store/store';
import { simulateLatency } from '../../services/http';
import { navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { firstName } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, DemoBadge } from '../../components/ui/Display';
import { Field } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Overlay';
import {
  accountByEmail,
  CHOOSER_ACCOUNTS,
  emailProblem,
  msg,
  nameFromEmail,
  PROVIDER_NAME,
  type ProviderAccount,
  type SocialProvider,
} from './authHelpers';

/** Which step of the chooser is showing. */
export type ChooserView =
  | { kind: 'choose' }
  /** Log in mode: the provider account isn't a Wayfare user yet (screen 1F). */
  | { kind: 'no-account'; account: ProviderAccount }
  /** Sign-up mode: confirm creating an account with this provider account. */
  | { kind: 'new-account'; account: ProviderAccount }
  /** Sign-up mode: this email already has a Wayfare account (screen 1I). */
  | { kind: 'has-account'; account: ProviderAccount };

/** What the provider shares when you sign in (never Gmail or social access). */
function sharedLine(provider: SocialProvider): string {
  return provider === 'google'
    ? 'Google shares only your name, email address, and profile photo with Wayfare. Reading Gmail is a separate permission you can choose later.'
    : 'Apple shares only your name and email address with Wayfare. Nothing else.';
}

/** The simulated provider sheet. Mounting it opens it; `onClose` unmounts it. */
export function SocialChooser({
  provider,
  mode,
  initialView,
  onClose,
}: {
  provider: SocialProvider;
  mode: 'login' | 'signup';
  initialView?: ChooserView;
  onClose: () => void;
}) {
  const [view, setView] = useState<ChooserView>(initialView ?? { kind: 'choose' });
  /** Email of the account row being signed in, or the confirm action in progress. */
  const [busy, setBusy] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherEmail, setOtherEmail] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const providerName = PROVIDER_NAME[provider];

  // Async handlers check this so they don't update a closed sheet.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (otherOpen) otherRef.current?.focus();
  }, [otherOpen]);

  // Moving between steps re-renders the same dialog, so put focus on the new
  // step's main action (the button that was focused no longer exists).
  const primaryRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    (view.kind === 'choose' ? firstRowRef.current : primaryRef.current)?.focus();
  }, [view.kind]);

  /** The user picked a provider account (a listed one or "another account"). */
  async function pick(account: ProviderAccount) {
    setBusy(account.email);
    await simulateLatency(700);
    if (!alive.current) return;
    setBusy(null);
    if (mode === 'login') {
      const result = logInWithProvider(provider, account.email);
      if (result.ok) {
        onClose();
        navigate(paths.home(), { replace: true });
        return;
      }
      setView({ kind: 'no-account', account });
      return;
    }
    // Sign-up mode: an email that's already registered should log in instead.
    setView(accountByEmail(getState(), account.email) ? { kind: 'has-account', account } : { kind: 'new-account', account });
  }

  /** Create the Wayfare account from the provider account, then open Page 2. */
  async function createAccount(account: ProviderAccount) {
    setBusy('create');
    await simulateLatency(700);
    if (!alive.current) return;
    const result = signUp({ name: account.name, email: account.email, provider });
    if (!result.ok) {
      setBusy(null);
      setView({ kind: 'has-account', account });
      return;
    }
    onClose();
    navigate(paths.connect(), { replace: true });
  }

  /** Sign-up mode found an existing account: log in with the provider instead. */
  async function logInInstead(account: ProviderAccount) {
    setBusy('login');
    await simulateLatency(700);
    if (!alive.current) return;
    const result = logInWithProvider(provider, account.email);
    if (result.ok) {
      onClose();
      navigate(paths.home(), { replace: true });
      return;
    }
    setBusy(null);
    setView({ kind: 'new-account', account });
  }

  function submitOther(e: FormEvent) {
    e.preventDefault();
    const problem = emailProblem(otherEmail);
    if (problem) {
      setOtherError(problem);
      otherRef.current?.focus();
      return;
    }
    void pick({ name: nameFromEmail(otherEmail), email: otherEmail.trim(), color: 'av-4' });
  }

  const backToList = () => {
    setBusy(null);
    setView({ kind: 'choose' });
  };

  /* ---------------------------------------------------- step: pick account */
  if (view.kind === 'choose') {
    return (
      <Sheet open onClose={onClose} title={`Choose ${provider === 'apple' ? 'an' : 'a'} ${providerName} account`} description="to continue to Wayfare" size="sm">
        <div className="stack-md">
          <div className="p01-sim">
            <DemoBadge>Simulated</DemoBadge>
            <p>In the real app this opens {providerName}’s own sign-in page.</p>
          </div>

          <ul className="p01-acct-list" aria-label={`${providerName} accounts`}>
            {CHOOSER_ACCOUNTS.map((account, i) => (
              <li key={account.email}>
                <button
                  ref={i === 0 ? firstRowRef : undefined}
                  type="button"
                  className="p01-acct"
                  onClick={() => void pick(account)}
                  disabled={!!busy}
                  aria-busy={busy === account.email || undefined}
                  data-autofocus={i === 0 ? true : undefined}
                >
                  <Avatar person={account} size={40} />
                  <span className="p01-acct-text">
                    <span className="p01-acct-name">{account.name}</span>
                    <span className="p01-acct-email">{account.email}</span>
                  </span>
                  {busy === account.email ? <Loader2 className="p01-acct-end spin" aria-label="Signing in" /> : <ChevronRight className="p01-acct-end" aria-hidden />}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="p01-acct" onClick={() => setOtherOpen((v) => !v)} aria-expanded={otherOpen} disabled={!!busy && !otherOpen}>
                <span className="p01-acct-icon" aria-hidden>
                  <UserPlus />
                </span>
                <span className="p01-acct-text">
                  <span className="p01-acct-name">Use another account</span>
                </span>
              </button>
              {otherOpen && (
                <form className="p01-other" onSubmit={submitOther} noValidate>
                  <Field label={`${providerName} email`} error={otherError}>
                    {(p) => (
                      <input
                        {...p}
                        ref={otherRef}
                        className="input"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="name@example.com"
                        value={otherEmail}
                        onChange={(e) => {
                          setOtherEmail(e.target.value);
                          setOtherError(null);
                        }}
                      />
                    )}
                  </Field>
                  <Button type="submit" variant="secondary" block loading={!!busy && busy === otherEmail.trim()}>
                    Continue
                  </Button>
                </form>
              )}
            </li>
          </ul>

          <p className="p01-shared">
            <ShieldCheck aria-hidden />
            <span>{sharedLine(provider)}</span>
          </p>
          <p className="p01-chooser-hint">Demo: Maya Chen already has a Wayfare account. Alex Rivera doesn’t yet.</p>
        </div>
      </Sheet>
    );
  }

  /* ------------------------------------------- step: result for an account */
  const { account } = view;
  const titles: Record<Exclude<ChooserView['kind'], 'choose'>, ReactNode> = {
    'no-account': (
      <>
        No Wayfare account for <span className="p01-break">{account.email}</span>
      </>
    ),
    'new-account': 'Create your Wayfare account',
    'has-account': 'You already have a Wayfare account',
  };

  const footer =
    view.kind === 'has-account' ? (
      <>
        <Button ref={primaryRef} data-autofocus onClick={() => void logInInstead(account)} loading={busy === 'login'}>
          Log in as {firstName(account.name)}
        </Button>
        <Button variant="secondary" icon={<ArrowLeft />} onClick={backToList} disabled={!!busy}>
          Use a different account
        </Button>
      </>
    ) : (
      <>
        <Button ref={primaryRef} data-autofocus onClick={() => void createAccount(account)} loading={busy === 'create'}>
          {view.kind === 'no-account' ? 'Create an account' : 'Create account'}
        </Button>
        <Button variant="secondary" icon={<ArrowLeft />} onClick={backToList} disabled={!!busy}>
          Use a different account
        </Button>
      </>
    );

  return (
    <Sheet open onClose={onClose} title={titles[view.kind]} size="sm" footer={footer} className="p01-result-sheet">
      <div className="stack-md">
        <div className="p01-acct-card">
          <Avatar person={account} size={44} />
          <span className="p01-acct-text">
            <span className="p01-acct-name">{account.name}</span>
            <span className="p01-acct-email">{account.email}</span>
          </span>
          <Badge tone="neutral">{providerName} account</Badge>
        </div>

        {view.kind === 'no-account' && (
          <p className="p01-result-text">
            {providerName} signed you in, but this email isn’t registered with Wayfare yet. Create an account now with this {providerName} account. No password needed.
          </p>
        )}
        {view.kind === 'new-account' && (
          <p className="p01-result-text">We’ll set up your Wayfare account with this {providerName} account. No password needed.</p>
        )}
        {view.kind === 'has-account' && (
          <p className="p01-result-text">
            {msg.emailInUse(account.email)} Log in instead.
          </p>
        )}

        {view.kind !== 'has-account' && (
          <p className="p01-shared">
            <ShieldCheck aria-hidden />
            <span>
              {provider === 'google'
                ? 'Wayfare gets only your name, email address, and photo from Google. Connecting Gmail is a separate step you can choose next.'
                : 'Wayfare gets only your name and email address from Apple. Connecting other apps is a separate step you can choose next.'}
            </span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
