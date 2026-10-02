/**
 * A place's "profile picture" (Page 8 asks for one on every event).
 * Falls back to an illustrated tile with a category icon when there's no
 * photo or it fails to load (e.g. a live Wikipedia photo is offline).
 */

import { useState } from 'react';
import {
  BedDouble,
  Castle,
  Coffee,
  Compass,
  Landmark,
  MapPin,
  Mountain,
  ShoppingBag,
  Store,
  TrainFront,
  Trees,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import type { PlaceCategory } from '../../data/types';
import { photoUrl } from '../../data/places';
import './domain.css';

const ICONS: Record<PlaceCategory, typeof MapPin> = {
  landmark: Castle,
  museum: Landmark,
  viewpoint: Mountain,
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  market: Store,
  bar: Wine,
  nature: Trees,
  lodging: BedDouble,
  transit: TrainFront,
  shopping: ShoppingBag,
  tour: Compass,
  other: MapPin,
};

export function CategoryIcon({ category, className }: { category: PlaceCategory; className?: string }) {
  const Icon = ICONS[category] ?? MapPin;
  return <Icon className={className} aria-hidden />;
}

export function PlacePhoto({
  photo,
  alt,
  category = 'other',
  size = 'thumb',
  className = '',
  rounded = true,
}: {
  photo?: string;
  alt: string;
  category?: PlaceCategory;
  size?: 'thumb' | 'full';
  className?: string;
  rounded?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl(photo, size);
  const classes = `place-photo ${rounded ? 'is-rounded' : ''} ${className}`;
  if (!src || failed) {
    return (
      <span className={`${classes} place-photo-fallback cat-${category}`} role="img" aria-label={alt}>
        <CategoryIcon category={category} />
      </span>
    );
  }
  return <img className={classes} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
