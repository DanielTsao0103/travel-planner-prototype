/** Prototype tool: photo credits and open-data/library attributions. */

import credits from '../data/photoCredits.json';
import { paths } from '../router/routes';
import { photoUrl } from '../data/places';
import { PageHeader } from '../components/layout/PageHeader';
import './proto.css';

interface Credit {
  subject: string;
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export function CreditsPage() {
  const rows = Object.entries(credits as Record<string, Credit>).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="container page proto-page">
      <PageHeader eyebrow="Prototype tools" title="Credits" back={{ to: paths.protoIndex(), label: 'Screen index' }} subtitle="Open data, libraries, and photos used in this prototype." />
      <section className="stack-md">
        <h2 className="h3">Data and services</h2>
        <ul className="proto-credits-list">
          <li>Map tiles and place data © OpenStreetMap contributors (ODbL), via tile.openstreetmap.org, Photon (komoot), Overpass API, and the FOSSGIS OSRM routing server.</li>
          <li>Live photos for places you add come from Wikipedia, Wikidata, and Wikimedia Commons (free licenses only), including geotagged photos taken near the place.</li>
          <li>When no photo of a place exists, a generic photo of that kind of place is shown with a “Representative photo” tag (the cat-* photos below). It doesn’t show the actual place.</li>
          <li>Map library: Leaflet (BSD-2). Icons: Lucide (ISC). Fonts: Bricolage Grotesque and Figtree (SIL Open Font License) via Google Fonts.</li>
          <li>All people, emails, restaurants, rentals, receipts, bank alerts, and booking confirmations are fictional.</li>
        </ul>
      </section>
      <section className="stack-md">
        <h2 className="h3">Photos (Wikimedia Commons)</h2>
        <div className="table-scroll">
          <table className="proto-table">
            <thead>
              <tr>
                <th scope="col">Photo</th>
                <th scope="col">Subject</th>
                <th scope="col">Author</th>
                <th scope="col">License</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, c]) => (
                <tr key={id}>
                  <td>
                    <img src={photoUrl(id, 'thumb')} alt="" className="proto-thumb" loading="lazy" />
                  </td>
                  <td>
                    <a href={c.source} target="_blank" rel="noreferrer">
                      {c.subject || c.file}
                    </a>
                  </td>
                  <td>{c.author}</td>
                  <td>{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> : c.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
