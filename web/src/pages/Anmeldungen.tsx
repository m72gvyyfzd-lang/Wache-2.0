import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { mockAnmeldungen } from "../data/mockData";

export function Anmeldungen() {
  return (
    <div>
      <PageHeader title="Anmeldungen" description="Weitere Jobs — keine feste Ein-/Ausgehend-Kategorie" />
      <Panel title="Anmeldungen" count={`${mockAnmeldungen.length} Einträge`}>
        <table>
          <thead>
            <tr>
              <th className="num">Nr</th>
              <th>Typ</th>
              <th className="num">Kat</th>
              <th className="num">Lotse</th>
              <th>Datum/Zeit</th>
            </tr>
          </thead>
          <tbody>
            {mockAnmeldungen.map((r, i) => (
              <tr key={i}>
                <td className="num muted">{r.nr}</td>
                <td>{r.typ}</td>
                <td className="num muted">{r.kat}</td>
                <td className="num muted">{r.lotse}</td>
                <td className="num">{r.datumZeit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
