/**
 * Home-page destination suggestions (Page 4) and an offline list of popular
 * cities used when the live city search (Photon) is unreachable (Page 6).
 */

import type { Destination } from './types';

export interface SuggestedDestination {
  id: string;
  name: string;
  region: string;
  photo: string;
  /** Estimated cost per person for the suggested length, excluding flights. */
  estCostPerPerson: number;
  /** Suggested trip length in days, as a range. */
  days: [number, number];
  pitch: string;
  /** What gets prefilled on Page 6 when the user taps "Plan this trip". */
  destination: Destination;
}

export const HOME_SUGGESTIONS: SuggestedDestination[] = [
  {
    id: 'kyoto',
    name: 'Kyoto',
    region: 'Japan',
    photo: 'kyoto',
    estCostPerPerson: 2900,
    days: [6, 7],
    pitch: 'Temples, tea houses, and fall color in the hills. Pairs well with a day in Osaka.',
    destination: { id: 'd-kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
  },
  {
    id: 'mexico-city',
    name: 'Mexico City',
    region: 'Mexico',
    photo: 'mexico-city',
    estCostPerPerson: 1300,
    days: [4, 5],
    pitch: 'World-class museums, market food, and Teotihuacan as an easy day trip.',
    destination: { id: 'd-cdmx', name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  },
  {
    id: 'iceland',
    name: 'Iceland’s South Coast',
    region: 'Iceland',
    photo: 'iceland',
    estCostPerPerson: 3100,
    days: [6, 6],
    pitch: 'Waterfalls, black-sand beaches, and glacier walks on a loop from Reykjavík.',
    destination: { id: 'd-vik', name: 'Vík', country: 'Iceland', lat: 63.4186, lng: -19.006 },
  },
];

/** Offline fallback for the city search on Page 6. */
export const POPULAR_CITIES: Destination[] = [
  ['Lisbon', 'Portugal', 38.7223, -9.1393],
  ['Porto', 'Portugal', 41.1579, -8.6291],
  ['Sintra', 'Portugal', 38.8029, -9.3817],
  ['Madrid', 'Spain', 40.4168, -3.7038],
  ['Barcelona', 'Spain', 41.3874, 2.1686],
  ['Seville', 'Spain', 37.3891, -5.9845],
  ['Paris', 'France', 48.8566, 2.3522],
  ['Nice', 'France', 43.7102, 7.262],
  ['London', 'United Kingdom', 51.5072, -0.1276],
  ['Edinburgh', 'United Kingdom', 55.9533, -3.1883],
  ['Dublin', 'Ireland', 53.3498, -6.2603],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041],
  ['Berlin', 'Germany', 52.52, 13.405],
  ['Munich', 'Germany', 48.1351, 11.582],
  ['Prague', 'Czechia', 50.0755, 14.4378],
  ['Vienna', 'Austria', 48.2082, 16.3738],
  ['Rome', 'Italy', 41.9028, 12.4964],
  ['Florence', 'Italy', 43.7696, 11.2558],
  ['Venice', 'Italy', 45.4408, 12.3155],
  ['Athens', 'Greece', 37.9838, 23.7275],
  ['Santorini', 'Greece', 36.3932, 25.4615],
  ['Istanbul', 'Türkiye', 41.0082, 28.9784],
  ['Reykjavík', 'Iceland', 64.1466, -21.9426],
  ['Vík', 'Iceland', 63.4186, -19.006],
  ['Tokyo', 'Japan', 35.6762, 139.6503],
  ['Kyoto', 'Japan', 35.0116, 135.7681],
  ['Osaka', 'Japan', 34.6937, 135.5023],
  ['Seoul', 'South Korea', 37.5665, 126.978],
  ['Bangkok', 'Thailand', 13.7563, 100.5018],
  ['Singapore', 'Singapore', 1.3521, 103.8198],
  ['Bali', 'Indonesia', -8.3405, 115.092],
  ['Sydney', 'Australia', -33.8688, 151.2093],
  ['Mexico City', 'Mexico', 19.4326, -99.1332],
  ['Oaxaca', 'Mexico', 17.0732, -96.7266],
  ['Cancún', 'Mexico', 21.1619, -86.8515],
  ['New York', 'United States', 40.7128, -74.006],
  ['San Francisco', 'United States', 37.7749, -122.4194],
  ['Los Angeles', 'United States', 34.0522, -118.2437],
  ['Chicago', 'United States', 41.8781, -87.6298],
  ['New Orleans', 'United States', 29.9511, -90.0715],
  ['Nashville', 'United States', 36.1627, -86.7816],
  ['Honolulu', 'United States', 21.3069, -157.8583],
  ['Kauai', 'United States', 22.0964, -159.5261],
  ['Salt Lake City', 'United States', 40.7608, -111.891],
  ['Banff', 'Canada', 51.1784, -115.5708],
  ['Vancouver', 'Canada', 49.2827, -123.1207],
  ['Montréal', 'Canada', 45.5019, -73.5674],
  ['Cartagena', 'Colombia', 10.391, -75.4794],
  ['Cusco', 'Peru', -13.532, -71.9675],
  ['Buenos Aires', 'Argentina', -34.6037, -58.3816],
  ['Rio de Janeiro', 'Brazil', -22.9068, -43.1729],
  ['Marrakesh', 'Morocco', 31.6295, -7.9811],
  ['Cape Town', 'South Africa', -33.9249, 18.4241],
].map(([name, country, lat, lng]) => ({
  id: `city-${String(name).toLowerCase().replace(/[^a-z]+/g, '-')}`,
  name: String(name),
  country: String(country),
  lat: Number(lat),
  lng: Number(lng),
}));
