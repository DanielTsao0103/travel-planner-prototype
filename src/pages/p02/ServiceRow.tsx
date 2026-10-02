/**
 * One row of the Page 2 checklist: a check mark, the service tile, its status,
 * the next action (Connect / Add permission / Try again / Disconnect), and an
 * expandable list of every permission with "Granted" / "Not granted" and what
 * it unlocks.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Circle, Info, RotateCw, X } from 'lucide-react';
import type { Connection } from '../../data/types';
import type { ServiceInfo } from '../../data/services';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Display';
import { missingCount, rowStatus, type RowStatus } from './connectHelpers';
import { ServiceTile } from './ServiceTile';

/** The text status chip next to the service name. */
export function StatusChip({ status, missing }: { status: RowStatus; missing: number }) {
  if (status === 'connected')
    return (
      <Badge tone="success" icon={<Check aria-hidden />}>
        Connected
      </Badge>
    );
  if (status === 'needs-permission')
    return (
      <Badge tone="warning" icon={<AlertTriangle aria-hidden />}>
        {missing === 1 ? '1 permission still needed' : `${missing} permissions still needed`}
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge tone="danger" icon={<X aria-hidden />}>
        Couldn’t connect
      </Badge>
    );
  return <Badge tone="neutral">Not connected</Badge>;
}

/** The checklist mark on the left of each row (decorative; the chip carries the meaning). */
function CheckMark({ status }: { status: RowStatus }) {
  return (
    <span className={`p02-check is-${status}`} aria-hidden>
      {status === 'connected' || status === 'needs-permission' ? <Check /> : status === 'failed' ? <X /> : null}
    </span>
  );
}

/** One service in the checklist. `compact` switches to the stacked phone layout. */
export function ServiceRow({
  info,
  conn,
  googleSignIn,
  compact,
  defaultOpen = false,
  highlight = false,
  onDisconnect,
}: {
  info: ServiceInfo;
  conn: Connection | undefined;
  /** The account signed in with Google (changes the Gmail note). */
  googleSignIn: boolean;
  /** Phone layout: stacked, with full-width buttons. */
  compact: boolean;
  /** Start with the permission details expanded. */
  defaultOpen?: boolean;
  /** Briefly highlight the row (it just changed on Page 3). */
  highlight?: boolean;
  onDisconnect: () => void;
}) {
  const status = rowStatus(conn);
  const missing = missingCount(conn);
  const [open, setOpen] = useState(defaultOpen);
  // A row can start needing a permission after it first rendered (e.g. right
  // after connecting with an optional permission off): open it then too.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const detailsId = useId();
  const rowRef = useRef<HTMLLIElement>(null);

  // App.tsx scrolls to the top on every route change, so bring a just-changed
  // row back into view (after that scroll) if it isn't fully visible.
  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => {
      const rect = rowRef.current?.getBoundingClientRect();
      if (rect && (rect.top < 72 || rect.bottom > window.innerHeight - 96)) rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlight]);
  const permissions = info.permissions.map((p) => ({ ...p, granted: conn?.permissions.find((c) => c.key === p.key)?.granted ?? false }));
  const grantedCount = permissions.filter((p) => p.granted).length;
  const connected = status === 'connected' || status === 'needs-permission';

  const action =
    status === 'not-connected' ? (
      <Button variant="subtle" to={paths.connectService(info.id)} aria-label={`Connect ${info.name}`}>
        Connect
      </Button>
    ) : status === 'failed' ? (
      <Button variant="subtle" icon={<RotateCw />} to={paths.connectService(info.id)} aria-label={`Try connecting ${info.name} again`}>
        Try again
      </Button>
    ) : status === 'needs-permission' ? (
      <Button variant="subtle" to={paths.connectService(info.id)} aria-label={`Add ${info.name} permission`}>
        Add permission
      </Button>
    ) : (
      <Button variant="ghost" onClick={onDisconnect} aria-label={`Disconnect ${info.name}`} className="p02-disconnect">
        Disconnect
      </Button>
    );

  const head = (
    <div className="p02-row-head">
      <h3 className="p02-name">{info.name}</h3>
      <StatusChip status={status} missing={missing} />
    </div>
  );

  const body = (
    <div className="p02-row-body">
      <p className="p02-tagline">{info.tagline}</p>
      {info.id === 'gmail' && (
        <p className="p02-note">
          <Info aria-hidden />
          <span>
            {googleSignIn
              ? 'You signed in with Google. That only shared your name, email address, and photo. Reading Gmail needs this separate permission.'
              : info.note}
          </span>
        </p>
      )}
      {status === 'failed' && <p className="p02-failed-note">The last attempt didn’t go through. Nothing was shared.</p>}
    </div>
  );

  const toggle = (
    <button type="button" className="p02-more" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
      <span>Permissions</span>
      {!compact && <span className="p02-more-meta">· {connected ? `${grantedCount} of ${permissions.length} granted` : `${permissions.length} requested`}</span>}
      <ChevronDown aria-hidden className="p02-more-chev" />
    </button>
  );

  const details = (
    <div id={detailsId} className="p02-details" hidden={!open}>
      <ul className="p02-perms" aria-label={`${info.name} permissions`}>
        {permissions.map((p) => (
          <li key={p.key} className={`p02-perm ${p.granted ? 'is-granted' : ''}`}>
            <span className="p02-perm-icon" aria-hidden>
              {p.granted ? <Check /> : <Circle />}
            </span>
            <span className="p02-perm-text">
              <span className="p02-perm-label">{p.label}</span>
              <span className="p02-perm-unlocks">{p.unlocks}</span>
            </span>
            <span className="p02-perm-meta">
              <span className="p02-perm-state">{p.granted ? 'Granted' : 'Not granted'}</span>
              {p.required && <span className="p02-perm-req">Required</span>}
            </span>
          </li>
        ))}
      </ul>
      {status === 'needs-permission' && (
        <div className="p02-details-foot">
          <Button variant="ghost" size={compact ? 'md' : 'sm'} onClick={onDisconnect} className="p02-disconnect">
            Disconnect {info.name}
          </Button>
        </div>
      )}
    </div>
  );

  // Phone: tile + name on top, then the description, then [action][Permissions] side by side.
  if (compact) {
    return (
      <li ref={rowRef} className={`p02-row is-compact is-${status} ${highlight ? 'is-just' : ''}`}>
        <div className="p02-row-top">
          <CheckMark status={status} />
          <ServiceTile service={info.id} />
          {head}
        </div>
        {body}
        {/* Connected rows lead with "Permissions"; Disconnect is the quieter option. */}
        <div className={`p02-row-foot ${status === 'connected' ? 'is-reversed' : ''}`}>
          {action}
          {toggle}
        </div>
        {details}
      </li>
    );
  }

  // Tablet/desktop: check · tile · text column · action on the right.
  return (
    <li ref={rowRef} className={`p02-row is-wide is-${status} ${highlight ? 'is-just' : ''}`}>
      <CheckMark status={status} />
      <ServiceTile service={info.id} />
      <div className="p02-row-main">
        {head}
        {body}
        {toggle}
      </div>
      <div className="p02-row-action">{action}</div>
      {details}
    </li>
  );
}
