/**
 * Layer controls for the map: a row of toggle chips (quick) and a detailed
 * "Show on the map" list with a switch and description per layer (the
 * `s=layers` state opens and highlights it).
 */

import { forwardRef } from 'react';
import { Layers, X } from 'lucide-react';
import { IconButton } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Field';
import { LAYER_LABEL, type LayerId } from './mapData';

/** A small pin-like swatch that matches the layer's pins on the map. */
function Swatch({ layer }: { layer: LayerId }) {
  return (
    <span className={`p17-swatch is-${layer}`} aria-hidden="true">
      {layer === 'today' ? '1' : layer === 'ideas' ? '+' : ''}
    </span>
  );
}

export interface LayerChipsProps {
  available: LayerId[];
  layers: Set<LayerId>;
  onToggle: (id: LayerId) => void;
  className?: string;
}

/** Toggle chips, one per layer (aria-pressed shows which are on). */
export function LayerChips({ available, layers, onToggle, className = '' }: LayerChipsProps) {
  return (
    <div className={`p17-chips ${className}`} role="group" aria-label="Show on the map">
      {available.map((id) => (
        <button key={id} type="button" className="p17-chip" aria-pressed={layers.has(id)} onClick={() => onToggle(id)}>
          <Swatch layer={id} />
          <span>{LAYER_LABEL[id]}</span>
        </button>
      ))}
    </div>
  );
}

export interface LayerPanelProps {
  available: LayerId[];
  layers: Set<LayerId>;
  onToggle: (id: LayerId) => void;
  /** One-line description per layer (counts, loading state…). */
  describe: (id: LayerId) => string;
  onClose?: () => void;
  /** Draw attention to the panel (deep link `s=layers`). */
  emphasize?: boolean;
}

/** The detailed layer list with switches. */
export const LayerPanel = forwardRef<HTMLElement, LayerPanelProps>(function LayerPanel({ available, layers, onToggle, describe, onClose, emphasize }, ref) {
  return (
    <section ref={ref} id="p17-layers" className={`p17-layers ${emphasize ? 'is-emphasized' : ''}`} aria-labelledby="p17-layers-title" tabIndex={-1}>
      <div className="p17-layers-head">
        <h2 id="p17-layers-title" className="p17-layers-title">
          <Layers aria-hidden />
          Show on the map
        </h2>
        {onClose && <IconButton label="Close layer list" icon={<X />} onClick={onClose} />}
      </div>
      <ul className="p17-layer-list">
        {available.map((id) => (
          <li key={id} className="p17-layer-item">
            <Swatch layer={id} />
            <div className="grow">
              <Switch label={LAYER_LABEL[id]} description={describe(id)} checked={layers.has(id)} onChange={() => onToggle(id)} />
            </div>
          </li>
        ))}
      </ul>
      <p className="xsmall muted">Your location is simulated for this prototype. Map data and places come from OpenStreetMap and Wikipedia.</p>
    </section>
  );
});
