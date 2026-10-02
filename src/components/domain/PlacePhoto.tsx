/**
 * A place's "profile picture" (Page 8 asks for one on every event), also used
 * for idea cards, map lists, and trip covers.
 *
 * Every slot ends up with a real photo:
 *  1. the place's own photo (bundled or saved earlier), else
 *  2. a photo looked up online for this exact place or city (pass `place` or
 *     `destination`), saved back to the trip so it sticks, else
 *  3. a representative photo for that kind of place (labeled in its alt text).
 * While a lookup is running (up to ~1.2 s) the slot shows a soft shimmer.
 */

import { useEffect, useState } from 'react';
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
import { categoryPhoto } from '../../data/categoryPhotos';
import type { Destination, Place, PlaceCategory } from '../../data/types';
import { photoUrl } from '../../data/places';
import { findCityImage, findPlaceImage } from '../../services/placeImages';
import { rememberPlacePhoto, rememberTripCover } from '../../store/actions';
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

/** Category icon (used in chips and legends; photos no longer fall back to it). */
export function CategoryIcon({ category, className }: { category: PlaceCategory; className?: string }) {
  const Icon = ICONS[category] ?? MapPin;
  return <Icon className={className} aria-hidden />;
}

const KIND_LABEL: Record<PlaceCategory, string> = {
  landmark: 'a landmark',
  museum: 'a museum',
  viewpoint: 'a viewpoint',
  restaurant: 'a restaurant',
  cafe: 'a café',
  market: 'a market',
  bar: 'a bar',
  nature: 'a park',
  lodging: 'a place to stay',
  transit: 'a station',
  shopping: 'a shop',
  tour: 'a tour',
  other: 'travel',
};

export function PlacePhoto({
  photo,
  alt,
  category = 'other',
  size = 'thumb',
  className = '',
  rounded = true,
  place,
  destination,
}: {
  photo?: string;
  alt: string;
  category?: PlaceCategory;
  size?: 'thumb' | 'full';
  className?: string;
  rounded?: boolean;
  /** Look up a real photo of this place when `photo` is missing. */
  place?: Place;
  /** Look up a photo of this city when `photo` is missing (trip covers). */
  destination?: Destination;
}) {
  const [ownFailed, setOwnFailed] = useState(false);
  const ownSrc = ownFailed ? undefined : photoUrl(photo, size);

  // Online lookup, only when there's no photo of our own.
  const lookupKey = ownSrc ? '' : place ? `p:${place.id}:${place.name}` : destination ? `d:${destination.id}:${destination.name}` : '';
  const [found, setFound] = useState<{ key: string; url: string | null } | null>(null);
  const [foundFailed, setFoundFailed] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);

  useEffect(() => {
    if (!lookupKey) return;
    let alive = true;
    setWaitedLong(false);
    setFoundFailed(false);
    const timer = window.setTimeout(() => alive && setWaitedLong(true), 1200);
    const job = place ? findPlaceImage(place) : findCityImage(destination!);
    void job.then((url) => {
      if (!alive) return;
      setFound({ key: lookupKey, url });
      // Save it on the trip's events/ideas (or the trip cover) so it sticks after a reload.
      if (url) {
        if (place) rememberPlacePhoto(place.id, url);
        else if (destination) rememberTripCover(destination.id, url);
      }
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  const classes = `place-photo ${rounded ? 'is-rounded' : ''} ${className}`;

  if (ownSrc) {
    return <img className={classes} src={ownSrc} alt={alt} loading="lazy" decoding="async" onError={() => setOwnFailed(true)} />;
  }

  const result = found && found.key === lookupKey ? found.url : undefined; // undefined = still looking
  if (lookupKey && result === undefined && !waitedLong) {
    return <span className={`${classes} skeleton`} role="img" aria-label={alt || 'Loading photo'} />;
  }
  if (result && !foundFailed) {
    return <img className={classes} src={result} alt={alt} loading="lazy" decoding="async" onError={() => setFoundFailed(true)} />;
  }

  // Representative photo for this kind of place (never an icon tile).
  const kind = destination && !place ? 'other' : category;
  const seed = place?.id ?? destination?.id ?? alt ?? kind;
  const label = `Representative photo of ${KIND_LABEL[kind]}`;
  const src = photoUrl(categoryPhoto(kind, seed), size);
  const altText = alt ? `${alt} (${label.toLowerCase()})` : label;
  if (size === 'full') {
    // Big slots get a small corner tag so nobody mistakes it for the actual place.
    return (
      <span className={`${classes} place-photo-frame is-representative`} role="img" aria-label={altText} title={label}>
        <img className="place-photo-fill" src={src} alt="" loading="lazy" decoding="async" />
        <span className="place-photo-note" aria-hidden>
          Representative photo
        </span>
      </span>
    );
  }
  return <img className={`${classes} is-representative`} src={src} alt={altText} title={label} loading="lazy" decoding="async" />;
}
