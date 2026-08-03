import { getAbteilzeitSettings } from "@wache/core";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { LotsenEintrag } from "../data/types";
import { sortiereEintraege, vonTypeLabel } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";
import "./Einsatzplanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

function nachBrunsbuettelPositionSortiert(lotsenliste: LotsenEintrag[]) {
  return [...lotsenliste].sort((a, b) => {
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
  const { jobs, lotsen } = useData();
  const jobsSortiert = sortiereEintraege(jobs, settings);
  const lotsenSortiert = nachBrunsbuettelPositionSortiert(lotsen);
  const zeilen = Math.max(jobsSortiert.length, lotsenSortiert.length);

  return (
    <div>
      <PageHeader title="Einsatzplanung" />
      <Panel title="Zuordnung" count={`${zeilen} Zeilen`}>
        <table className="einsatz-table">
          <thead>
            <tr className="einsatz-table__gruppen">
              <th colSpan={5}>Jobs</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th colSpan={4}>Lotsen</th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th>Von / Type</th>
              <th>Schiffsname</th>
              <th className="num">Kat.</th>
              <th className="num">Abt. Zeit</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th className="num">#</th>
              <th>Name</th>
              <th className="num">Kat.</th>
              <th>EH</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: zeilen }).map((_, i) => {
              const paar = jobsSortiert[i];
              const lotse = lotsenSortiert[i];
              return (
                <tr key={i}>
                  {paar ? (
                    <>
                      <td className="num muted">{i + 1}</td>
                      <td>
                        <Badge>{vonTypeLabel(paar.eintrag)}</Badge>
                      </td>
                      <td className="cell-name">{paar.eintrag.schiffsname ?? "–"}</td>
                      <td className="num muted">{paar.eintrag.kategorie ?? "·"}</td>
                      <td className="num">{formatUhrzeit(paar.abteilzeit)}</td>
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
                      <td className="cell-name">{lotse.name}</td>
                      <td className="num">{lotse.kategorie}</td>
                      <td className="muted" />
                    </>
                  ) : (
                    <td colSpan={4} className="muted">
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
