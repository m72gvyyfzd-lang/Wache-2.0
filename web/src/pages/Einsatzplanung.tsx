import { getAbteilzeitSettings, sortiereJobsNachAbteilzeit } from "@wache/core";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { mockJobs, mockLotsenliste } from "../data/mockData";
import { formatUhrzeit, herkunftVon } from "../lib/format";
import "./Einsatzplanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

function nachBrunsbuettelPositionSortiert() {
  return [...mockLotsenliste].sort((a, b) => {
    const posA = Number(a.positionBrunsbuettelBoert);
    const posB = Number(b.positionBrunsbuettelBoert);
    const aValide = a.positionBrunsbuettelBoert !== "" && !Number.isNaN(posA);
    const bValide = b.positionBrunsbuettelBoert !== "" && !Number.isNaN(posB);
    if (!aValide && !bValide) return 0;
    if (!aValide) return 1;
    if (!bValide) return -1;
    return posA - posB;
  });
}

export function Einsatzplanung() {
  const jobsSortiert = sortiereJobsNachAbteilzeit(mockJobs, settings);
  const lotsenSortiert = nachBrunsbuettelPositionSortiert();
  const zeilen = Math.max(jobsSortiert.length, lotsenSortiert.length);

  return (
    <div>
      <PageHeader
        title="Einsatzplanung"
        description="Jobs (HH + NOK + Anmeldungen, nach Abteilzeit sortiert) ↔ verfügbare Lotsen (nach Reihenfolge) — Normalfall: Zeile 1 zu Zeile 1, Zeile 2 zu Zeile 2, ..."
      />
      <Panel title="Zuordnung" count={`${zeilen} Zeilen`}>
        <table className="einsatz-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Herkunft</th>
              <th>Abteilzeit</th>
              <th>Bezeichnung</th>
              <th className="num">Kat</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th className="num">Pos.</th>
              <th>Lotse</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: zeilen }).map((_, i) => {
              const eintrag = jobsSortiert[i];
              const lotse = lotsenSortiert[i];
              return (
                <tr key={i}>
                  {eintrag ? (
                    <>
                      <td className="num muted">{i + 1}</td>
                      <td>
                        <Badge>{herkunftVon(eintrag.job.routentyp)}</Badge>
                      </td>
                      <td className="num">{formatUhrzeit(eintrag.abteilzeit)}</td>
                      <td className="einsatz-table__name">{eintrag.job.bezeichnung ?? "–"}</td>
                      <td className="num muted">{eintrag.job.kategorie ?? "·"}</td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                  <td className="einsatz-table__divider" aria-hidden="true">
                    <span className="einsatz-table__arrow">→</span>
                  </td>
                  {lotse ? (
                    <>
                      <td className="num muted">{lotse.positionBrunsbuettelBoert}</td>
                      <td className="einsatz-table__name">{lotse.name}</td>
                    </>
                  ) : (
                    <td colSpan={2} className="muted">
                      –
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
