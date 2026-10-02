/**
 * Bundled place catalog for the built-in trips (sample trip, past trips, invites)
 * and the bundled suggestions. Bundling these means the sample trip always
 * works, even if the live open-data services are slow or down.
 *
 * Real landmarks use their real names and approximate coordinates.
 * Restaurants, rentals, and anything that makes dietary claims are FICTIONAL
 * (`fictional: true`) so we never misattribute a claim to a real business.
 * Accessibility values are illustrative for the prototype.
 */

import type { Place } from './types';

type PlaceInput = Omit<Place, 'source' | 'tags' | 'stepFree' | 'ticketRequired'> &
  Partial<Pick<Place, 'tags' | 'stepFree' | 'ticketRequired'>>;

function place(input: PlaceInput): Place {
  return { tags: [], stepFree: 'unknown', ticketRequired: false, source: 'bundled', ...input };
}

export const PLACES: Record<string, Place> = Object.fromEntries(
  [
    /* ---------------------------------------------------------------- Lisbon */
    place({
      id: 'casa-azulejo', name: 'Casa Azulejo Alfama', area: 'Alfama', city: 'Lisbon',
      lat: 38.7113, lng: -9.1296, category: 'lodging', busyProfile: 'lodging', photo: 'alfama',
      stepFree: 'yes', blurb: 'Your 3-bedroom rental with a lift (fictional listing).', fictional: true,
    }),
    place({
      id: 'santa-luzia', name: 'Miradouro de Santa Luzia', area: 'Alfama', city: 'Lisbon',
      lat: 38.7117, lng: -9.1302, category: 'viewpoint', busyProfile: 'viewpoint', photo: 'santa-luzia',
      tags: ['view', 'historic'], stepFree: 'partial', blurb: 'Tiled terrace overlooking Alfama’s rooftops and the river.',
    }),
    place({
      id: 'mare-alta', name: 'Taberna Maré Alta', area: 'Alfama', city: 'Lisbon',
      lat: 38.7105, lng: -9.131, category: 'restaurant', busyProfile: 'restaurant', photo: 'seafood',
      tags: ['seafood', 'local-cuisine', 'lively', 'vegetarian-friendly'], stepFree: 'yes',
      blurb: 'Grilled sardines and petiscos in a neighborhood tavern (fictional).', fictional: true,
    }),
    place({
      id: 'jeronimos', name: 'Jerónimos Monastery', area: 'Belém', city: 'Lisbon',
      lat: 38.6979, lng: -9.2068, category: 'landmark', busyProfile: 'museum', photo: 'jeronimos',
      tags: ['historic', 'cultural'], stepFree: 'partial', ticketRequired: true,
      blurb: '16th-century monastery and UNESCO World Heritage site.',
    }),
    place({
      id: 'pasteis-belem', name: 'Pastéis de Belém', area: 'Belém', city: 'Lisbon',
      lat: 38.6975, lng: -9.2033, category: 'cafe', busyProfile: 'cafe', photo: 'pasteis-belem',
      tags: ['local-cuisine'], stepFree: 'partial', blurb: 'The famous custard-tart bakery, open since 1837.',
    }),
    place({
      id: 'time-out-market', name: 'Time Out Market', area: 'Cais do Sodré', city: 'Lisbon',
      lat: 38.7069, lng: -9.1459, category: 'market', busyProfile: 'market', photo: 'time-out-market',
      tags: ['local-cuisine', 'lively'], stepFree: 'yes', blurb: 'Food hall in the Mercado da Ribeira.',
    }),
    place({
      id: 'santa-justa', name: 'Santa Justa Lift', area: 'Baixa', city: 'Lisbon',
      lat: 38.7121, lng: -9.1394, category: 'landmark', busyProfile: 'landmark', photo: 'santa-justa',
      tags: ['historic', 'view'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Iron elevator from 1902 linking Baixa and Chiado.',
    }),
    place({
      id: 'casa-lumiar', name: 'Casa Lumiar', area: 'Chiado', city: 'Lisbon',
      lat: 38.7108, lng: -9.142, category: 'restaurant', busyProfile: 'restaurant', photo: 'restaurant',
      tags: ['gluten-free-options', 'local-cuisine', 'upscale', 'quiet', 'vegetarian-friendly'], stepFree: 'yes',
      blurb: 'Modern Portuguese tasting menu with a gluten-free version (fictional).', fictional: true,
    }),
    place({
      id: 'rossio-station', name: 'Rossio Station', area: 'Baixa', city: 'Lisbon',
      lat: 38.7142, lng: -9.1405, category: 'transit', busyProfile: 'transit', photo: 'rossio-station',
      stepFree: 'yes', blurb: 'Trains to Sintra every 20 minutes.',
    }),
    place({
      id: 'castelo', name: 'Castelo de São Jorge', area: 'Castelo', city: 'Lisbon',
      lat: 38.7139, lng: -9.1335, category: 'landmark', busyProfile: 'landmark', photo: 'castelo',
      tags: ['historic', 'view', 'cultural'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Moorish castle on Lisbon’s highest hill.',
    }),
    place({
      id: 'tram-28', name: 'Tram 28 ride', area: 'Martim Moniz → Estrela', city: 'Lisbon',
      lat: 38.7163, lng: -9.1357, category: 'tour', busyProfile: 'transit', photo: 'tram-28',
      tags: ['historic'], stepFree: 'no', blurb: 'The classic yellow tram through Graça, Alfama, and Chiado.',
    }),
    place({
      id: 'adega-becos', name: 'Adega dos Becos', area: 'Alfama', city: 'Lisbon',
      lat: 38.711, lng: -9.1285, category: 'restaurant', busyProfile: 'bar', photo: 'fado',
      tags: ['cultural', 'local-cuisine', 'quiet'], stepFree: 'yes', ticketRequired: true,
      blurb: 'Fado house with a set dinner; reservations required (fictional).', fictional: true,
    }),
    place({
      id: 'santa-apolonia', name: 'Santa Apolónia Station', area: 'Alfama', city: 'Lisbon',
      lat: 38.7137, lng: -9.1225, category: 'transit', busyProfile: 'transit', photo: 'santa-apolonia',
      stepFree: 'yes', ticketRequired: true, blurb: 'Intercity trains to Porto (about 3 hours).',
    }),
    /* ---------------------------------------------------------------- Sintra */
    place({
      id: 'pena', name: 'Pena Palace', area: 'Sintra', city: 'Sintra',
      lat: 38.7876, lng: -9.3906, category: 'landmark', busyProfile: 'landmark', photo: 'pena',
      tags: ['historic', 'cultural', 'view'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Romanticist palace on a hilltop; timed entry tickets.',
    }),
    place({
      id: 'tasca-serra', name: 'Tasca da Serra', area: 'Sintra', city: 'Sintra',
      lat: 38.7979, lng: -9.3881, category: 'restaurant', busyProfile: 'restaurant', photo: 'caldo-verde',
      tags: ['local-cuisine', 'casual', 'vegetarian-friendly', 'nut-free-kitchen'], stepFree: 'yes',
      blurb: 'Soups, grilled fish, and a nut-free kitchen (fictional).', fictional: true,
    }),
    place({
      id: 'regaleira', name: 'Quinta da Regaleira', area: 'Sintra', city: 'Sintra',
      lat: 38.7963, lng: -9.3961, category: 'landmark', busyProfile: 'landmark', photo: 'regaleira',
      tags: ['historic', 'nature'], stepFree: 'no', ticketRequired: true,
      blurb: 'Gardens, grottoes, and the spiral Initiation Well (steep paths and stairs).',
    }),
    place({
      id: 'sintra-station', name: 'Sintra Station', area: 'Sintra', city: 'Sintra',
      lat: 38.7984, lng: -9.3866, category: 'transit', busyProfile: 'transit', photo: 'rossio-station',
      stepFree: 'yes', blurb: 'Trains back to Rossio, Lisbon.',
    }),
    place({
      id: 'monserrate', name: 'Monserrate Palace', area: 'Sintra', city: 'Sintra',
      lat: 38.793, lng: -9.4206, category: 'landmark', busyProfile: 'museum', photo: 'monserrate',
      tags: ['historic', 'nature'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Quieter palace with botanical gardens, 10 minutes past Regaleira.',
    }),
    /* -------------------------------------------------------- Lisbon (ideas) */
    place({
      id: 'maat', name: 'MAAT', area: 'Belém', city: 'Lisbon',
      lat: 38.6957, lng: -9.1946, category: 'museum', busyProfile: 'museum', photo: 'maat',
      tags: ['modern', 'art'], stepFree: 'yes', ticketRequired: true,
      blurb: 'Museum of Art, Architecture and Technology on the riverfront.',
    }),
    place({
      id: 'padaria-celeste', name: 'Padaria Celeste', area: 'Cais do Sodré', city: 'Lisbon',
      lat: 38.7074, lng: -9.1472, category: 'cafe', busyProfile: 'cafe', photo: 'sourdough',
      tags: ['gluten-free-dedicated', 'nut-free-kitchen', 'local-cuisine', 'casual'], stepFree: 'yes',
      blurb: 'Dedicated gluten-free bakery with a nut-free kitchen (fictional).', fictional: true,
    }),
    place({
      id: 'azulejo-museum', name: 'National Tile Museum', area: 'Xabregas', city: 'Lisbon',
      lat: 38.7247, lng: -9.1135, category: 'museum', busyProfile: 'museum', photo: 'azulejo-museum',
      tags: ['cultural', 'art', 'historic'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Five centuries of Portuguese azulejo tiles in a former convent.',
    }),
    place({
      id: 'sao-pedro-alcantara', name: 'Miradouro de São Pedro de Alcântara', area: 'Bairro Alto', city: 'Lisbon',
      lat: 38.7155, lng: -9.1442, category: 'viewpoint', busyProfile: 'viewpoint', photo: 'sao-pedro-alcantara',
      tags: ['view'], stepFree: 'yes', blurb: 'Garden viewpoint facing the castle; best at sunset.',
    }),
    place({
      id: 'belem-tower', name: 'Belém Tower', area: 'Belém', city: 'Lisbon',
      lat: 38.6916, lng: -9.216, category: 'landmark', busyProfile: 'landmark', photo: 'belem-tower',
      tags: ['historic', 'cultural'], stepFree: 'no', ticketRequired: true,
      blurb: '16th-century fortress on the Tagus (narrow stairs inside).',
    }),
    place({
      id: 'lx-factory', name: 'LX Factory', area: 'Alcântara', city: 'Lisbon',
      lat: 38.7034, lng: -9.1786, category: 'shopping', busyProfile: 'market', photo: 'lx-factory',
      tags: ['modern', 'art', 'lively'], stepFree: 'partial', blurb: 'Former factory full of shops, cafés, and street art.',
    }),
    place({
      id: 'horta-graca', name: 'Horta da Graça', area: 'Graça', city: 'Lisbon',
      lat: 38.7166, lng: -9.131, category: 'restaurant', busyProfile: 'restaurant', photo: 'veg-dish',
      tags: ['vegetarian-friendly', 'vegan-options', 'quiet', 'local-cuisine'], stepFree: 'yes',
      blurb: 'Vegetarian Portuguese petiscos with a terrace (fictional).', fictional: true,
    }),
    place({
      id: 'vinho-alto', name: 'Vinho Alto', area: 'Bairro Alto', city: 'Lisbon',
      lat: 38.7128, lng: -9.1452, category: 'bar', busyProfile: 'bar', photo: 'wine-bar',
      tags: ['lively', 'local-cuisine'], stepFree: 'partial', blurb: 'Natural-wine bar with small plates (fictional).', fictional: true,
    }),
    /* ----------------------------------------------------------------- Porto */
    place({
      id: 'ribeira-loft', name: 'Ribeira Loft Apartments', area: 'Ribeira', city: 'Porto',
      lat: 41.1412, lng: -8.6128, category: 'lodging', busyProfile: 'lodging', photo: 'ribeira-porto',
      stepFree: 'yes', blurb: 'Riverside apartment with a ground-floor bedroom (fictional listing).', fictional: true,
    }),
    place({
      id: 'lello', name: 'Livraria Lello', area: 'Baixa', city: 'Porto',
      lat: 41.1469, lng: -8.6149, category: 'shopping', busyProfile: 'landmark', photo: 'lello',
      tags: ['historic', 'cultural'], stepFree: 'partial', ticketRequired: true,
      blurb: 'Neo-Gothic bookshop with the famous red staircase; timed tickets.',
    }),
    place({
      id: 'douro-velho', name: 'Café Douro Velho', area: 'Baixa', city: 'Porto',
      lat: 41.1425, lng: -8.614, category: 'restaurant', busyProfile: 'restaurant', photo: 'francesinha',
      tags: ['local-cuisine', 'casual', 'gluten-free-options'], stepFree: 'yes',
      blurb: 'Francesinhas, including a gluten-free one (fictional).', fictional: true,
    }),
    place({
      id: 'cave-ribeirinha', name: 'Cave Ribeirinha Port Cellars', area: 'Vila Nova de Gaia', city: 'Porto',
      lat: 41.1372, lng: -8.6128, category: 'tour', busyProfile: 'museum', photo: 'port-cellar',
      tags: ['cultural', 'historic'], stepFree: 'yes', ticketRequired: true,
      blurb: 'Cellar tour and port tasting across the river (fictional).', fictional: true,
    }),
    place({
      id: 'dom-luis', name: 'Dom Luís I Bridge', area: 'Ribeira', city: 'Porto',
      lat: 41.1399, lng: -8.6094, category: 'landmark', busyProfile: 'viewpoint', photo: 'porto',
      tags: ['view', 'historic'], stepFree: 'yes', blurb: 'Double-deck iron bridge; walk the upper deck for the view.',
    }),
    place({
      id: 'sao-bento', name: 'São Bento Station', area: 'Baixa', city: 'Porto',
      lat: 41.1456, lng: -8.6107, category: 'landmark', busyProfile: 'transit', photo: 'sao-bento',
      tags: ['historic', 'cultural', 'art'], stepFree: 'yes', blurb: 'Station hall covered in 20,000 blue azulejo tiles.',
    }),
    place({
      id: 'serralves', name: 'Serralves Museum & Park', area: 'Aldoar', city: 'Porto',
      lat: 41.1597, lng: -8.6597, category: 'museum', busyProfile: 'museum', photo: 'serralves',
      tags: ['modern', 'art', 'nature'], stepFree: 'yes', ticketRequired: true,
      blurb: 'Contemporary art museum with an Art Deco villa and gardens.',
    }),
    place({
      id: 'rabelo-cruise', name: 'Six Bridges River Cruise', area: 'Ribeira pier', city: 'Porto',
      lat: 41.14, lng: -8.612, category: 'tour', busyProfile: 'landmark', photo: 'rabelo',
      tags: ['view', 'cultural'], stepFree: 'partial', ticketRequired: true, blurb: '50-minute cruise on a traditional rabelo boat.',
    }),
    place({
      id: 'palacio-cristal', name: 'Crystal Palace Gardens', area: 'Massarelos', city: 'Porto',
      lat: 41.1477, lng: -8.6255, category: 'nature', busyProfile: 'nature', photo: 'palacio-cristal',
      tags: ['nature', 'view'], stepFree: 'partial', blurb: 'Hilltop gardens with peacocks and river views.',
    }),
    /* ----------------------------------------------------------------- Kauai */
    place({
      id: 'waimea', name: 'Waimea Canyon Lookout', area: 'Waimea', city: 'Kauai',
      lat: 22.073, lng: -159.661, category: 'nature', busyProfile: 'nature', photo: 'waimea',
      tags: ['nature', 'view'], stepFree: 'partial', blurb: '“Grand Canyon of the Pacific.”',
    }),
    place({
      id: 'hanalei', name: 'Hanalei Bay', area: 'Hanalei', city: 'Kauai',
      lat: 22.2133, lng: -159.4983, category: 'nature', busyProfile: 'nature', photo: 'hanalei',
      tags: ['nature'], stepFree: 'partial', blurb: 'Crescent beach and historic pier on the North Shore.',
    }),
    place({
      id: 'kauai-luau', name: 'Coconut Grove Lūʻau', area: 'Kapaʻa', city: 'Kauai',
      lat: 22.0806, lng: -159.319, category: 'restaurant', busyProfile: 'restaurant', photo: 'luau',
      tags: ['cultural', 'lively', 'family-friendly'], stepFree: 'yes', ticketRequired: true,
      blurb: 'Dinner show with hula and fire dancing (fictional).', fictional: true,
    }),
    /* ------------------------------------------------------------------- NYC */
    place({
      id: 'central-park', name: 'Central Park', area: 'Manhattan', city: 'New York',
      lat: 40.7826, lng: -73.9656, category: 'nature', busyProfile: 'nature', photo: 'central-park',
      tags: ['nature'], stepFree: 'yes',
    }),
    place({
      id: 'the-met', name: 'The Met', area: 'Upper East Side', city: 'New York',
      lat: 40.7794, lng: -73.9632, category: 'museum', busyProfile: 'museum', photo: 'the-met',
      tags: ['art', 'cultural', 'historic'], stepFree: 'yes', ticketRequired: true,
    }),
    place({
      id: 'broadway-show', name: 'Broadway show', area: 'Theater District', city: 'New York',
      lat: 40.759, lng: -73.9845, category: 'other', busyProfile: 'bar', photo: 'broadway',
      tags: ['cultural', 'lively'], stepFree: 'yes', ticketRequired: true,
    }),
    place({
      id: 'lucas-trattoria', name: 'Luca’s Trattoria', area: 'Midtown', city: 'New York',
      lat: 40.7614, lng: -73.9776, category: 'restaurant', busyProfile: 'restaurant', photo: 'restaurant',
      tags: ['familiar-food', 'lively'], stepFree: 'yes', blurb: 'Birthday dinner spot (fictional).', fictional: true,
    }),
    /* ----------------------------------------------------------------- Banff */
    place({
      id: 'moraine-lake', name: 'Moraine Lake', area: 'Lake Louise', city: 'Banff',
      lat: 51.3217, lng: -116.186, category: 'nature', busyProfile: 'nature', photo: 'banff',
      tags: ['nature', 'view'], stepFree: 'partial',
    }),
    place({
      id: 'lake-louise', name: 'Lake Louise', area: 'Lake Louise', city: 'Banff',
      lat: 51.4176, lng: -116.2167, category: 'nature', busyProfile: 'nature', photo: 'lake-louise',
      tags: ['nature', 'view'], stepFree: 'yes',
    }),
    place({
      id: 'banff-gondola', name: 'Banff Gondola', area: 'Sulphur Mountain', city: 'Banff',
      lat: 51.144, lng: -115.5736, category: 'landmark', busyProfile: 'landmark', photo: 'banff-gondola',
      tags: ['view', 'nature'], stepFree: 'yes', ticketRequired: true,
    }),
    place({
      id: 'johnston-canyon', name: 'Johnston Canyon', area: 'Bow Valley', city: 'Banff',
      lat: 51.2456, lng: -115.8396, category: 'nature', busyProfile: 'nature', photo: 'johnston-canyon',
      tags: ['nature'], stepFree: 'no',
    }),
    /* ----------------------------------------------------------- Mexico City */
    place({
      id: 'bellas-artes', name: 'Palacio de Bellas Artes', area: 'Centro', city: 'Mexico City',
      lat: 19.4352, lng: -99.1412, category: 'museum', busyProfile: 'museum', photo: 'mexico-city',
      tags: ['art', 'cultural', 'historic'], stepFree: 'partial', ticketRequired: true,
    }),
    place({
      id: 'frida', name: 'Frida Kahlo Museum', area: 'Coyoacán', city: 'Mexico City',
      lat: 19.3551, lng: -99.1625, category: 'museum', busyProfile: 'museum', photo: 'frida',
      tags: ['art', 'cultural'], stepFree: 'partial', ticketRequired: true,
    }),
    place({
      id: 'teotihuacan', name: 'Teotihuacan', area: 'San Juan Teotihuacán', city: 'Mexico City',
      lat: 19.6925, lng: -98.8438, category: 'landmark', busyProfile: 'landmark', photo: 'teotihuacan',
      tags: ['historic', 'cultural'], stepFree: 'no', ticketRequired: true,
    }),
    place({
      id: 'la-lumbre', name: 'Taquería La Lumbre', area: 'Roma Norte', city: 'Mexico City',
      lat: 19.4185, lng: -99.1622, category: 'restaurant', busyProfile: 'restaurant', photo: 'tacos',
      tags: ['local-cuisine', 'casual', 'lively'], stepFree: 'yes', blurb: 'Al pastor until late (fictional).', fictional: true,
    }),
    place({
      id: 'coyoacan', name: 'Coyoacán Plaza', area: 'Coyoacán', city: 'Mexico City',
      lat: 19.35, lng: -99.1617, category: 'landmark', busyProfile: 'market', photo: 'coyoacan',
      tags: ['cultural', 'historic'], stepFree: 'yes',
    }),
  ].map((p) => [p.id, p]),
);

/** Get a bundled place by id (throws during development if the id is wrong). */
export function getPlace(id: string): Place {
  const found = PLACES[id];
  if (!found) throw new Error(`Unknown bundled place: ${id}`);
  return found;
}

/** Resolve a photo reference to a URL: bundled photo ids live in public/img. */
export function photoUrl(photo: string | undefined, size: 'full' | 'thumb' = 'thumb'): string | undefined {
  if (!photo) return undefined;
  if (/^(https?:|data:|blob:)/.test(photo)) return photo;
  return `${import.meta.env.BASE_URL}img/${photo}${size === 'thumb' ? '-t' : ''}.jpg`;
}
