/**
 * Page 1 — Log in / Create an account.
 *
 * Doc: the app opens on Log in, with a "New here? Create an Account" option.
 * Both modes offer Google, Apple, and email + password. A failed log in says
 * exactly why (we don't have that email, or the password doesn't match it),
 * and a Google/Apple user we don't know is prompted to create an account.
 *
 * Layout: tablet/desktop is a split screen (travel photo left, form right).
 * Phones get a short photo band with the wordmark, then a full-width form.
 *
 * Forced states (?s=), used by the screen index:
 *   default · email-not-found · wrong-password · google-chooser · apple-chooser ·
 *   social-not-found · social-exists (sign-up) · errors · loading
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Apple, ArrowRight, Check, Circle, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { APP_NAME } from '../../config';
import { photoUrl } from '../../data/places';
import credits from '../../data/photoCredits.json';
import { logIn, logOut, signUp } from '../../store/actions';
import { getState } from '../../store/store';
import { toast } from '../../store/toast';
import { simulateLatency } from '../../services/http';
import { navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/Display';
import { Field } from '../../components/ui/Field';
import { PrototypeDrawer } from '../../components/layout/PrototypeDrawer';
import {
  accountByEmail,
  carryEmail,
  clearCarriedEmail,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  emailProblem,
  exampleIdentity,
  msg,
  PASSWORD_RULES,
  passwordProblem,
  peekCarriedEmail,
  PROVIDER_NAME,
  type FormErrors,
  type SocialProvider,
} from './authHelpers';
import { SocialChooser, type ChooserView } from './SocialChooser';
import { Wordmark } from './Wordmark';
import './p01.css';

type AuthMode = 'login' | 'signup';

/** The photo on the left panel / top band (bundled, credited on the panel). */
const PHOTO_ID = 'kyoto';

/** Page 1. Rendered by App.tsx for /login (mode "login") and /signup (mode "signup"), without the app shell. */
export function AuthPage({ mode, query }: { mode: AuthMode; query: URLSearchParams }) {
  const forced = query.get('s');
  const hasAuthParam = query.has('auth');
  const [protoOpen, setProtoOpen] = useState(false);

  // Forced states can be opened from the screen index while a demo session is
  // active. These pages are the signed-out experience (App.tsx sends a signed-in
  // user from /login or /signup to Home), so end that session first; otherwise
  // "New here? Create an Account" would bounce to Home.
  useEffect(() => {
    if (forced && !hasAuthParam && getState().sessionAccountId) logOut();
  }, [forced, hasAuthParam]);

  // App.tsx titles every Page 1 route "Log in"; name the sign-up tab correctly.
  // (Deferred one tick so it runs after App's own title effect.)
  useEffect(() => {
    const t = window.setTimeout(() => {
      document.title = `${mode === 'signup' ? 'Create account' : 'Log in'} · ${APP_NAME}`;
    }, 0);
    return () => window.clearTimeout(t);
  }, [mode]);

  return (
    <div className="p01">
      <PhotoPanel />
      <main className="p01-main">
        <button type="button" className="proto-pill p01-proto" onClick={() => setProtoOpen(true)}>
          <FlaskConical aria-hidden />
          Prototype
        </button>
        {/* Keyed so switching Log in ↔ Create account (or forced state) starts a fresh form. */}
        <AuthForm key={`${mode}|${forced ?? ''}`} mode={mode} forced={forced} />
      </main>
      <PrototypeDrawer open={protoOpen} onClose={() => setProtoOpen(false)} />
    </div>
  );
}

/* --------------------------------------------------------------- photo */

interface PhotoCredit {
  subject: string;
  author: string;
  license: string;
}

/** Full-height photo (desktop) or short photo band (phone) with the wordmark and product line. */
function PhotoPanel() {
  const credit = (credits as Record<string, PhotoCredit>)[PHOTO_ID];
  return (
    <header className="p01-photo">
      <img className="p01-photo-img" src={photoUrl(PHOTO_ID, 'full')} alt="" />
      <div className="p01-photo-inner">
        <Wordmark tone="light" />
        <div className="p01-pitch-wrap">
          <div className="p01-pitch">
            <p className="p01-pitch-title">Plan trips together.</p>
            <p className="p01-pitch-sub">Ideas, plans, and costs in one place.</p>
          </div>
          {credit && (
            <p className="p01-credit">
              {credit.subject}, Kyoto · Photo: {credit.author} ({credit.license})
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- form */

interface ChooserOpen {
  provider: SocialProvider;
  view?: ChooserView;
}

interface FormInit {
  name: string;
  email: string;
  password: string;
  errors: FormErrors;
  chooser: ChooserOpen | null;
  /** Forced "loading" state: submit the demo login as soon as the form mounts. */
  autoSubmit: boolean;
}

const ALEX = { name: 'Alex Rivera', email: 'alex.rivera@example.com', color: 'av-2' };
const MAYA = { name: 'Maya Chen', email: DEMO_EMAIL, color: 'av-1' };

/** Starting values for the form, including the screen-index forced states. */
function initialForm(mode: AuthMode, forced: string | null, carried: string): FormInit {
  const base: FormInit = { name: '', email: carried, password: '', errors: {}, chooser: null, autoSubmit: false };
  const login = mode === 'login';
  switch (forced) {
    case 'email-not-found':
      return login ? { ...base, email: 'jamie@example.com', errors: { email: msg.emailNotFound('jamie@example.com'), emailAction: 'create-account' } } : base;
    case 'wrong-password':
      return login ? { ...base, email: DEMO_EMAIL, password: 'wayfare-2025', errors: { password: msg.wrongPassword(DEMO_EMAIL) } } : base;
    case 'google-chooser':
      return { ...base, chooser: { provider: 'google' } };
    case 'apple-chooser':
      return { ...base, chooser: { provider: 'apple' } };
    case 'social-not-found':
      return { ...base, chooser: { provider: 'google', view: login ? { kind: 'no-account', account: ALEX } : { kind: 'new-account', account: ALEX } } };
    case 'social-exists':
      return { ...base, chooser: { provider: 'google', view: login ? { kind: 'choose' } : { kind: 'has-account', account: MAYA } } };
    case 'errors':
      return login
        ? { ...base, errors: { email: 'Enter your email address.', password: 'Enter your password.' } }
        : {
            ...base,
            email: DEMO_EMAIL,
            password: 'trip',
            errors: { name: 'Enter your name.', email: msg.emailInUse(DEMO_EMAIL), emailAction: 'log-in', password: passwordProblem('trip') ?? undefined },
          };
    case 'loading':
      return login ? { ...base, email: DEMO_EMAIL, password: DEMO_PASSWORD, autoSubmit: true } : base;
    default:
      return base;
  }
}

/** The form column: heading, Google/Apple, email + password, mode switch, demo hint. */
function AuthForm({ mode, forced }: { mode: AuthMode; forced: string | null }) {
  const isLogin = mode === 'login';
  const [init] = useState(() => initialForm(mode, forced, peekCarriedEmail()));
  const [name, setName] = useState(init.name);
  const [email, setEmail] = useState(init.email);
  const [password, setPassword] = useState(init.password);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(init.errors);
  const [submitting, setSubmitting] = useState(init.autoSubmit);
  const [chooser, setChooser] = useState<ChooserOpen | null>(init.chooser);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The carried email (from the other mode) has been used; forget it.
  useEffect(() => clearCarriedEmail(), []);

  // Async submits check this so they never update an unmounted form.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Forced "loading" (1H): show the submitting state, then finish the demo log in.
  useEffect(() => {
    if (!init.autoSubmit) return;
    let cancelled = false;
    void (async () => {
      await simulateLatency(3500);
      if (cancelled) return;
      if (logIn(DEMO_EMAIL, DEMO_PASSWORD).ok) navigate(paths.home(), { replace: true });
      else setSubmitting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [init.autoSubmit]);

  /** Move focus to the first field that has an error. */
  function focusFirstError(errs: FormErrors) {
    if (errs.name) nameRef.current?.focus();
    else if (errs.email) emailRef.current?.focus();
    else if (errs.password) passwordRef.current?.focus();
  }

  function showErrors(errs: FormErrors) {
    setErrors(errs);
    // Wait a frame so the inputs are re-rendered with aria-invalid before focusing.
    window.requestAnimationFrame(() => focusFirstError(errs));
  }

  async function submitLogin() {
    const errs: FormErrors = {};
    const emailError = emailProblem(email);
    if (emailError) errs.email = emailError;
    if (!password) errs.password = 'Enter your password.';
    if (errs.email || errs.password) return showErrors(errs);

    setErrors({});
    setSubmitting(true);
    await simulateLatency(700);
    if (!alive.current) return;
    const result = logIn(email, password);
    if (result.ok) {
      navigate(paths.home(), { replace: true });
      return;
    }
    setSubmitting(false);
    if (result.error === 'email-not-found') {
      showErrors({ email: msg.emailNotFound(email), emailAction: 'create-account' });
      return;
    }
    // Accounts created with Google/Apple have no password: say so specifically.
    const account = accountByEmail(getState(), email);
    const social = account && !account.password ? account.providers.find((p): p is SocialProvider => p === 'google' || p === 'apple') : undefined;
    showErrors({ password: social ? msg.socialOnly(email, PROVIDER_NAME[social]) : msg.wrongPassword(email) });
  }

  async function submitSignup() {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Enter your name.';
    const emailError = emailProblem(email);
    if (emailError) errs.email = emailError;
    else if (accountByEmail(getState(), email)) {
      errs.email = msg.emailInUse(email);
      errs.emailAction = 'log-in';
    }
    const pwError = passwordProblem(password);
    if (pwError) errs.password = pwError;
    if (errs.name || errs.email || errs.password) return showErrors(errs);

    setErrors({});
    setSubmitting(true);
    await simulateLatency(700);
    if (!alive.current) return;
    const result = signUp({ name: name.trim(), email: email.trim(), password, provider: 'email' });
    if (!result.ok) {
      setSubmitting(false);
      showErrors({ email: msg.emailInUse(email), emailAction: 'log-in' });
      return;
    }
    // New accounts continue to Page 2 (connect apps).
    navigate(paths.connect(), { replace: true });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    void (isLogin ? submitLogin() : submitSignup());
  }

  /** Switch Log in ↔ Create account, keeping whatever email was typed. */
  function switchMode(target: AuthMode = isLogin ? 'signup' : 'login') {
    carryEmail(email);
    navigate(target === 'signup' ? paths.signup() : paths.login());
  }

  function fillDemo() {
    if (isLogin) {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    } else {
      const example = exampleIdentity(getState());
      setName(example.name);
      setEmail(example.email);
      setPassword(example.password);
    }
    setErrors({});
  }

  const clearError = (field: keyof FormErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined, ...(field === 'email' ? { emailAction: undefined } : {}) } : prev));

  return (
    <div className="p01-form-col">
      <header className="p01-head">
        <h1 className="p01-title">{isLogin ? 'Log in' : 'Create your account'}</h1>
        <p className="p01-sub">{isLogin ? 'Welcome back. Pick up where your group left off.' : 'Plan your next trip with friends and family, all in one place.'}</p>
      </header>

      <div className="p01-providers">
        <Button variant="secondary" block className="p01-provider" icon={<span className="p01-glyph" aria-hidden>G</span>} onClick={() => setChooser({ provider: 'google' })} disabled={submitting}>
          Continue with Google
        </Button>
        <Button variant="secondary" block className="p01-provider" icon={<Apple aria-hidden />} onClick={() => setChooser({ provider: 'apple' })} disabled={submitting}>
          Continue with Apple
        </Button>
      </div>

      <p className="p01-or">or</p>

      <form className="p01-form" onSubmit={onSubmit} noValidate aria-label={isLogin ? 'Log in with email' : 'Create an account with email'}>
        {!isLogin && (
          <Field label="Name" error={errors.name}>
            {(p) => (
              <input
                {...p}
                ref={nameRef}
                className="input"
                type="text"
                autoComplete="name"
                aria-required
                placeholder="Jamie Lee"
                value={name}
                readOnly={submitting}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError('name');
                }}
              />
            )}
          </Field>
        )}

        <div className="p01-field-group">
          <Field label="Email" error={errors.email}>
            {(p) => (
              <input
                {...p}
                ref={emailRef}
                className="input"
                type="email"
                inputMode="email"
                autoComplete={isLogin ? 'username' : 'email'}
                autoCapitalize="none"
                spellCheck={false}
                aria-required
                placeholder="name@example.com"
                value={email}
                readOnly={submitting}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                }}
              />
            )}
          </Field>
          {errors.email && errors.emailAction && (
            <button type="button" className="p01-inline-action" onClick={() => switchMode(errors.emailAction === 'create-account' ? 'signup' : 'login')}>
              {errors.emailAction === 'create-account' ? 'Create an account with this email' : 'Log in instead'}
              <ArrowRight aria-hidden />
            </button>
          )}
        </div>

        <Field
          label="Password"
          error={errors.password}
          hint={isLogin ? undefined : <PasswordHint value={password} />}
          aside={
            isLogin ? (
              <button
                type="button"
                className="p01-forgot"
                onClick={() =>
                  toast({ title: 'Password reset is simulated', body: 'In the real app we’d email you a reset link. For this demo, use the demo account below.', tone: 'info' })
                }
              >
                Forgot password?
              </button>
            ) : undefined
          }
        >
          {(p) => (
            <div className="p01-pw">
              <input
                {...p}
                ref={passwordRef}
                className="input p01-pw-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                aria-required
                value={password}
                readOnly={submitting}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError('password');
                }}
              />
              <button
                type="button"
                className="p01-pw-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                aria-controls={p.id}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" block loading={submitting} className="p01-submit">
          {submitting ? (isLogin ? 'Logging in…' : 'Creating your account…') : isLogin ? 'Log in' : 'Create account'}
        </Button>
      </form>

      <div className="p01-switch">
        <Button variant="subtle" block className="p01-switch-btn" onClick={() => switchMode()} disabled={submitting}>
          <span className="p01-switch-q">{isLogin ? 'New here?' : 'Already have an account?'}</span> {isLogin ? 'Create an Account' : 'Log in'}
        </Button>
      </div>

      <DemoHint mode={mode} onFill={fillDemo} disabled={submitting} />

      {chooser && (
        <SocialChooser key={chooser.provider} provider={chooser.provider} mode={mode} initialView={chooser.view} onClose={() => setChooser(null)} />
      )}
    </div>
  );
}

/** Sign-up password hint that turns into a live checklist once typing starts. */
function PasswordHint({ value }: { value: string }) {
  if (!value) return <>At least 8 characters and one number.</>;
  return (
    <span className="p01-rules" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <span key={rule.id} className={`p01-rule ${met ? 'is-met' : ''}`}>
            {met ? <Check aria-hidden /> : <Circle aria-hidden />}
            {rule.label}
            <span className="sr-only">{met ? ' (done)' : ' (still needed)'}</span>
          </span>
        );
      })}
    </span>
  );
}

/** The demo-credentials card. Unobtrusive, but always visible under the form. */
function DemoHint({ mode, onFill, disabled }: { mode: AuthMode; onFill: () => void; disabled?: boolean }) {
  return (
    <aside className="p01-demo" aria-label="Demo account">
      <div className="p01-demo-top">
        <DemoBadge>Demo</DemoBadge>
        <Button size="sm" variant="secondary" className="p01-fill" onClick={onFill} disabled={disabled}>
          {mode === 'login' ? 'Fill in' : 'Fill in example'}
        </Button>
      </div>
      {mode === 'login' ? (
        <>
          <p className="p01-demo-main">
            Demo account: <strong>{DEMO_EMAIL}</strong> / <strong>{DEMO_PASSWORD}</strong>
          </p>
          <p className="p01-demo-note">Or create an account with any made-up email. Nothing is sent anywhere. Don’t use a real password.</p>
        </>
      ) : (
        <>
          <p className="p01-demo-main">Use any made-up name and email. Nothing is sent anywhere. Don’t use a real password.</p>
          <p className="p01-demo-note">
            To log in instead, use the demo account: {DEMO_EMAIL} / {DEMO_PASSWORD}
          </p>
        </>
      )}
    </aside>
  );
}
