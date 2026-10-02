/**
 * Page 2 — "Skip for now" warning (screen 2D). Lists, for every service that
 * isn't connected yet, the features the user would be missing, then lets them
 * go back or skip anyway.
 */

import { CircleSlash } from 'lucide-react';
import type { ServiceInfo } from '../../data/services';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Overlay';
import { ServiceTile } from './ServiceTile';

export function SkipSheet({
  open,
  onClose,
  onSkip,
  unconnected,
}: {
  open: boolean;
  /** "Go back" (also the close button / Escape). */
  onClose: () => void;
  /** "Skip anyway": finish onboarding without connecting the rest. */
  onSkip: () => void;
  /** Services that aren't connected, in checklist order. */
  unconnected: ServiceInfo[];
}) {
  const featureCount = unconnected.reduce((n, s) => n + s.lostFeatures.length, 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Skip for now?"
      description={`Until you connect ${unconnected.length === 1 ? 'this account' : 'these accounts'}, ${featureCount === 1 ? 'this feature won’t' : `these ${featureCount} features won’t`} be available. You can connect them anytime.`}
      size="md"
      className="p02-skip"
      footer={
        <>
          <Button variant="secondary" onClick={onSkip}>
            Skip anyway
          </Button>
          <Button onClick={onClose} data-autofocus>
            Go back
          </Button>
        </>
      }
    >
      <ul className="p02-miss">
        {unconnected.map((info) => (
          <li key={info.id} className="p02-miss-svc">
            <div className="p02-miss-head">
              <ServiceTile service={info.id} size={28} />
              <h3 className="p02-miss-name">Without {info.name}</h3>
            </div>
            <ul className="p02-miss-features">
              {info.lostFeatures.map((feature) => (
                <li key={feature}>
                  <CircleSlash aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
