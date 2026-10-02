/** Prototype tool: requirement → screen checklist with links to each screen. */

import { CheckCircle2 } from 'lucide-react';
import { Link } from '../router/router';
import { paths } from '../router/routes';
import { PageHeader } from '../components/layout/PageHeader';
import { ALL_SCREENS } from './screens';
import { REQUIREMENTS } from './requirements';
import { screenHref } from './ScreenIndexPage';
import './proto.css';

export function ChecklistPage() {
  const byId = new Map(ALL_SCREENS.map((s) => [s.id, s]));
  return (
    <div className="container page proto-page">
      <PageHeader
        eyebrow="Prototype tools"
        title="Requirement checklist"
        subtitle="Each requirement from Step 3 onward of the source document (and the brief), with the screens that satisfy it."
        back={{ to: paths.protoIndex(), label: 'Screen index' }}
      />
      <div className="table-scroll">
        <table className="proto-table">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Requirement</th>
              <th scope="col">Screens</th>
              <th scope="col">How</th>
            </tr>
          </thead>
          <tbody>
            {REQUIREMENTS.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.page}</td>
                <td>
                  <span className="row" style={{ alignItems: 'flex-start' }}>
                    <CheckCircle2 className="proto-check" aria-label="Built" />
                    {r.text}
                  </span>
                </td>
                <td>
                  <span className="cluster">
                    {r.screens.map((id) => {
                      const s = byId.get(id);
                      return s ? (
                        <Link key={id} to={screenHref(s)} className="proto-chip num">
                          {id}
                        </Link>
                      ) : (
                        <span key={id} className="proto-chip num">
                          {id}
                        </span>
                      );
                    })}
                  </span>
                </td>
                <td className="muted">{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
