/** Versetzlisten: die beiden früher getrennten Seiten (Einsatzstation und
 *  Seestation) liegen jetzt als zwei Reiter in einer Karte. Die Auswahl
 *  jedes Reiters lebt weiterhin für sich — der "Rückgängig"-Knopf oben
 *  rechts gehört immer zum sichtbaren Reiter. */
import { useState } from "react";
import type { Geschwindigkeitsklasse } from "@wache/core";
import { Badge } from "../components/Badge";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { SpeedSelect } from "../components/formShared";
import { Switch } from "../components/SeestationModals";
import type { Abteilung } from "../data/types";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { formatUhrzeit } from "../lib/format";
import { etaSeestation } from "../lib/seestation";
import { gekoppelteAgAbteilungen } from "../lib/agKopplung";
import { useData } from "../state/DataContext";
import "./Versetzliste.css";

type Reiter = "einsatzstation" | "seestation";

/** Auswahl im Seestations-Reiter: Versetzung oder abgeschöpfter Lotse. */
type SeeAuswahl =
  | { typ: "seeAbteilung"; id: number }
  | { typ: "abgeschoepft"; quelle: "abteilung" | "manuell"; id: number };

interface AbgeschoepfterLotse {
  key: string;
  quelle: "abteilung" | "manuell";
  id: number;
  vNr: number;
  name: string;
  kategorie: string;
  elbehafen: boolean;
}

/** Bezeichnung eines Eintrags für die Rückfrage: mit V-Nr. der Schiffsname,
 *  ohne V-Nr. Type + Schiffsname. */
function eintragLabel(abteilung: Abteilung): string {
  if (abteilung.vNr !== undefined) return abteilung.schiffsname ?? "?";
  return [abteilung.typLabel, abteilung.schiffsname].filter(Boolean).join(" ");
}

/** Doppelklick auf eine Zeile "Lotsen im Revier": Abt.Zeit, Ankert-Status
 *  und Speed (Brb>>SEE-Matrix) nachträglich anpassen — die Ankunft S-Stn
 *  wird daraus live neu berechnet (siehe lib/seestation.ts::etaSeestation),
 *  auch wenn der Lotse schon abgeteilt ist. */
function AbteilungBearbeitenModal({
  initial,
  onUebernehmen,
  onAbbrechen,
}: {
  initial: { abteilZeit: Date; ankert: boolean; geschwindigkeitsklasse: Geschwindigkeitsklasse };
  onUebernehmen: (wert: {
    abteilZeit: Date;
    ankert: boolean;
    geschwindigkeitsklasse: Geschwindigkeitsklasse;
  }) => void;
  onAbbrechen: () => void;
}) {
  const [abtDatum, setAbtDatum] = useState(toLocalDateInput(initial.abteilZeit));
  const [abtZeit, setAbtZeit] = useState(toLocalTimeInput(initial.abteilZeit));
  const [ankert, setAnkert] = useState(initial.ankert);
  const [geschwindigkeit, setGeschwindigkeit] = useState(initial.geschwindigkeitsklasse);
  const neueAbteilZeit = ausDatumUndZeit(abtDatum, abtZeit);
  return (
    <div className="job-form">
      <div className="job-form__row">
        <label>
          Datum
          <input type="date" value={abtDatum} onChange={(e) => setAbtDatum(e.target.value)} />
        </label>
        <label>
          Abt. Zeit
          <input type="time" value={abtZeit} onChange={(e) => setAbtZeit(e.target.value)} required />
        </label>
      </div>
      <div className="job-form__row">
        <Switch label="ankert" checked={ankert} onChange={setAnkert} />
        <SpeedSelect value={geschwindigkeit} onChange={setGeschwindigkeit} />
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button
          type="button"
          className="btn btn--accent"
          disabled={neueAbteilZeit === undefined}
          onClick={() =>
            neueAbteilZeit &&
            onUebernehmen({ abteilZeit: neueAbteilZeit, ankert, geschwindigkeitsklasse: geschwindigkeit })
          }
        >
          OK
        </button>
      </div>
    </div>
  );
}

function LeereZeile({ spalten }: { spalten: number }) {
  return (
    <tr>
      <td colSpan={spalten} className="muted" style={{ textAlign: "center", padding: 20 }}>
        keine Einträge
      </td>
    </tr>
  );
}

export function Versetzlisten() {
  const {
    jobs,
    abteilungen,
    macheAbteilungRueckgaengig,
    updateAbteilung,
    seeAbteilungen,
    macheSeeAbteilungRueckgaengig,
    seestationLotsen,
    updateSeestationLotse,
  } = useData();

  const [reiter, setReiter] = useState<Reiter>("einsatzstation");
  const [frageOffen, setFrageOffen] = useState(false);
  const [bearbeiteAbteilung, setBearbeiteAbteilung] = useState<Abteilung | null>(null);
  // Auswahl gilt je Reiter über beide Listen hinweg — erneuter Klick wählt
  // wieder ab.
  const [auswahl, setAuswahl] = useState<number | null>(null);
  const [seeAuswahl, setSeeAuswahl] = useState<SeeAuswahl | null>(null);
  /** offene Rückfrage "AG-Lotsen mitnehmen?" beim Melden eines Trägers als
   *  auf der Seestation angekommen */
  const [agFrage, setAgFrage] = useState<{ traeger: Abteilung; agLotsen: Abteilung[] } | null>(null);

  // ---- Reiter 1: Einsatzstation ----
  // Lotsen, die schon auf der Seestation angekommen sind ("Auf Station"),
  // verschwinden aus dieser Liste — sie stehen dann nur noch im Tab
  // Seestation.
  const revier = abteilungen
    .filter((a) => a.vNr !== undefined && !a.aufSeestation)
    .sort((a, b) => a.vNr! - b.vNr!);
  const vergabe = abteilungen
    .filter((a) => a.vNr === undefined)
    .sort((a, b) => a.abteilZeit.getTime() - b.abteilZeit.getTime());
  const ausgewaehlt = auswahl !== null ? (abteilungen.find((a) => a.id === auswahl) ?? null) : null;

  // ---- Reiter 2: Seestation ----
  // "Versetz auf Seestation": Ausgabe des Seestation-Abteilens, fortlaufend
  // nach A-Nr. (unabhängig von der V-Nr.-Zählung der Einsatzplanung).
  const versetzt = [...seeAbteilungen].sort((a, b) => a.aNr - b.aNr);
  // "Abgeschöpfte Lotsen": alle auf der Seestation ("Auf Seestation")
  // abgeschöpften Lotsen beider Quellen — die Abschöpfen-Aktion dort blendet
  // sie nur aus, statt sie zu löschen.
  const abgeschoepft: AbgeschoepfterLotse[] = [
    ...abteilungen
      .filter((a) => a.abgeschoepft && a.vNr !== undefined)
      .map((a) => ({
        key: `abteilung-${a.id}`,
        quelle: "abteilung" as const,
        id: a.id,
        vNr: a.vNr!,
        name: a.lotsenName,
        kategorie: a.lotsenKategorie,
        elbehafen: a.elbehafen,
      })),
    ...seestationLotsen
      .filter((l) => l.abgeschoepft)
      .map((l) => ({
        key: `manuell-${l.id}`,
        quelle: "manuell" as const,
        id: l.id,
        vNr: l.vNr,
        name: l.name,
        kategorie: l.kategorie,
        elbehafen: l.elbehafen,
      })),
  ].sort((a, b) => a.vNr - b.vNr);

  const ausgewaehlteSeeAbteilung =
    seeAuswahl?.typ === "seeAbteilung" ? (seeAbteilungen.find((a) => a.id === seeAuswahl.id) ?? null) : null;
  const ausgewaehlterAbgeschoepfte =
    seeAuswahl?.typ === "abgeschoepft"
      ? (abgeschoepft.find((e) => e.quelle === seeAuswahl.quelle && e.id === seeAuswahl.id) ?? null)
      : null;

  function seeKlick(id: number) {
    setSeeAuswahl((aktiv) => (aktiv?.typ === "seeAbteilung" && aktiv.id === id ? null : { typ: "seeAbteilung", id }));
  }

  function abgeschoepftKlick(eintrag: AbgeschoepfterLotse) {
    setSeeAuswahl((aktiv) =>
      aktiv?.typ === "abgeschoepft" && aktiv.quelle === eintrag.quelle && aktiv.id === eintrag.id
        ? null
        : { typ: "abgeschoepft", quelle: eintrag.quelle, id: eintrag.id },
    );
  }

  // ---- gemeinsamer Rückgängig-Knopf ----
  const kannRueckgaengig = reiter === "einsatzstation" ? ausgewaehlt !== null : seeAuswahl !== null;

  const rueckgaengigFrage =
    reiter === "einsatzstation"
      ? ausgewaehlt
        ? `Soll die Abteilung von ${ausgewaehlt.lotsenName} zu ${eintragLabel(ausgewaehlt)} rückgängig gemacht werden?`
        : ""
      : ausgewaehlteSeeAbteilung
        ? `Soll die Versetzung von ${ausgewaehlteSeeAbteilung.lotsenName} zu ${ausgewaehlteSeeAbteilung.schiffsname} rückgängig gemacht werden?`
        : ausgewaehlterAbgeschoepfte
          ? `Soll das Abschöpfen von ${ausgewaehlterAbgeschoepfte.name} rückgängig gemacht werden?`
          : "";

  // ---- "Auf Seestation": derselbe Schritt wie im Aktionsfenster der
  // Seestations-Seite. Fahren AG-Lotsen auf demselben Schiff mit, fragt
  // die App vorher nach — sie können an Bord bleiben.
  const kannAufSeestation = ausgewaehlt !== null && ausgewaehlt.vNr !== undefined && !ausgewaehlt.aufSeestation;

  function setzeAufSeestation(ids: number[]) {
    for (const id of ids) updateAbteilung(id, { aufSeestation: true });
    setAuswahl(null);
    setAgFrage(null);
  }

  function handleAufSeestation() {
    if (!ausgewaehlt) return;
    const agLotsen = gekoppelteAgAbteilungen(ausgewaehlt, jobs, abteilungen).filter((a) => !a.aufSeestation);
    if (agLotsen.length === 0) {
      setzeAufSeestation([ausgewaehlt.id]);
      return;
    }
    setAgFrage({ traeger: ausgewaehlt, agLotsen });
  }

  function handleRueckgaengigJa() {
    if (reiter === "einsatzstation") {
      if (ausgewaehlt) macheAbteilungRueckgaengig(ausgewaehlt.id);
      setAuswahl(null);
    } else if (seeAuswahl?.typ === "seeAbteilung") {
      macheSeeAbteilungRueckgaengig(seeAuswahl.id);
      setSeeAuswahl(null);
    } else if (seeAuswahl?.typ === "abgeschoepft") {
      if (seeAuswahl.quelle === "abteilung") updateAbteilung(seeAuswahl.id, { abgeschoepft: false });
      else updateSeestationLotse(seeAuswahl.id, { abgeschoepft: false });
      setSeeAuswahl(null);
    }
    setFrageOffen(false);
  }

  return (
    <div>
      <PageHeader title="Versetzlisten" centered />

      <Panel>
        <div className="versetz-kopfzeile">
          <div className="versetz-reiter" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={reiter === "einsatzstation"}
              className={"versetz-reiter__knopf" + (reiter === "einsatzstation" ? " versetz-reiter__knopf--aktiv" : "")}
              onClick={() => setReiter("einsatzstation")}
              data-testid="reiter-einsatzstation"
            >
              Versetzliste Einsatzstation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reiter === "seestation"}
              className={"versetz-reiter__knopf" + (reiter === "seestation" ? " versetz-reiter__knopf--aktiv" : "")}
              onClick={() => setReiter("seestation")}
              data-testid="reiter-seestation"
            >
              Versetzliste Seestation
            </button>
          </div>
          {reiter === "einsatzstation" && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={!kannAufSeestation}
              onClick={handleAufSeestation}
              data-testid="auf-seestation"
            >
              Auf Seestation
            </button>
          )}
          <button
            type="button"
            className="btn btn--accent"
            disabled={!kannRueckgaengig}
            onClick={() => setFrageOffen(true)}
            data-testid="rueckgaengig"
          >
            {reiter === "einsatzstation" ? "Abteilung rückgängig machen" : "Rückgängig machen"}
          </button>
        </div>

        {reiter === "einsatzstation" ? (
          <div data-testid="liste-einsatzstation">
            <h3 className="versetz-abschnitt">Lotsen im Revier</h3>
            <table className="versetz-table">
              <thead>
                <tr>
                  <th className="num zentriert">V-Nr.</th>
                  <th>Schiffsname</th>
                  <th>Lotsenname</th>
                  <th className="num zentriert">Kat.</th>
                  <th className="num zentriert">EH</th>
                  <th className="num zentriert">Abteilzeit</th>
                  <th className="num zentriert kopf-umbruch">Ankunft S-Stn</th>
                  <th className="num zentriert">Ankert</th>
                </tr>
              </thead>
              <tbody>
                {revier.map((a) => (
                  <tr
                    key={a.id}
                    className={"row-click" + (auswahl === a.id ? " ist-ausgewaehlt" : "")}
                    onClick={() => setAuswahl((aktiv) => (aktiv === a.id ? null : a.id))}
                    onDoubleClick={() => setBearbeiteAbteilung(a)}
                  >
                    <td className="num zentriert fett">{a.vNr}</td>
                    <td className="cell-name">{a.schiffsname ?? "–"}</td>
                    <td>{a.lotsenName}</td>
                    <td className="num muted zentriert">{a.lotsenKategorie}</td>
                    <td className="num zentriert">{a.elbehafen ? "✓" : ""}</td>
                    <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
                    <td className="num muted zentriert">{formatUhrzeit(etaSeestation(a))}</td>
                    <td className="num muted zentriert">{a.ankert ? "⚓️" : "–"}</td>
                  </tr>
                ))}
                {revier.length === 0 && <LeereZeile spalten={8} />}
              </tbody>
            </table>

            <h3 className="versetz-abschnitt">Vergabe-Liste</h3>
            <table className="versetz-table">
              <thead>
                <tr>
                  <th className="zentriert schmal">Type</th>
                  <th>Schiffsname</th>
                  <th>Lotsenname</th>
                  <th className="num zentriert">Abteilzeit</th>
                </tr>
              </thead>
              <tbody>
                {vergabe.map((a) => (
                  <tr
                    key={a.id}
                    className={"row-click" + (auswahl === a.id ? " ist-ausgewaehlt" : "")}
                    onClick={() => setAuswahl((aktiv) => (aktiv === a.id ? null : a.id))}
                  >
                    <td className="zentriert schmal">
                      <Badge>{a.typLabel}</Badge>
                    </td>
                    <td className="cell-name">{a.schiffsname ?? "–"}</td>
                    <td>{a.lotsenName}</td>
                    <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
                  </tr>
                ))}
                {vergabe.length === 0 && <LeereZeile spalten={4} />}
              </tbody>
            </table>
          </div>
        ) : (
          <div data-testid="liste-seestation">
            <h3 className="versetz-abschnitt">Versetz auf Seestation</h3>
            <table className="versetz-table">
              <thead>
                <tr>
                  <th className="num zentriert">A-Nr.</th>
                  <th>Schiffsname</th>
                  <th>Lotsenname</th>
                  <th className="num zentriert">Kat.</th>
                  <th className="num zentriert">EH</th>
                  <th className="num zentriert">Abteilzeit</th>
                </tr>
              </thead>
              <tbody>
                {versetzt.map((a) => (
                  <tr
                    key={a.id}
                    className={
                      "row-click" +
                      (seeAuswahl?.typ === "seeAbteilung" && seeAuswahl.id === a.id ? " ist-ausgewaehlt" : "")
                    }
                    onClick={() => seeKlick(a.id)}
                  >
                    <td className="num zentriert fett">{a.aNr}</td>
                    <td className="cell-name">{a.schiffsname}</td>
                    <td>{a.lotsenName}</td>
                    <td className="num muted zentriert">{a.lotsenKategorie}</td>
                    <td className="num zentriert">{a.elbehafen ? "✓" : ""}</td>
                    <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
                  </tr>
                ))}
                {versetzt.length === 0 && <LeereZeile spalten={6} />}
              </tbody>
            </table>

            <h3 className="versetz-abschnitt">Abgeschöpfte Lotsen</h3>
            <table className="versetz-table">
              <thead>
                <tr>
                  <th className="num zentriert">V-Nr.</th>
                  <th>Lotsenname</th>
                  <th className="num zentriert">Kat.</th>
                  <th className="num zentriert">EH</th>
                </tr>
              </thead>
              <tbody>
                {abgeschoepft.map((e) => (
                  <tr
                    key={e.key}
                    className={
                      "row-click" +
                      (seeAuswahl?.typ === "abgeschoepft" && seeAuswahl.quelle === e.quelle && seeAuswahl.id === e.id
                        ? " ist-ausgewaehlt"
                        : "")
                    }
                    onClick={() => abgeschoepftKlick(e)}
                  >
                    <td className="num zentriert fett">{e.vNr}</td>
                    <td>{e.name}</td>
                    <td className="num muted zentriert">{e.kategorie}</td>
                    <td className="num zentriert">{e.elbehafen ? "✓" : ""}</td>
                  </tr>
                ))}
                {abgeschoepft.length === 0 && <LeereZeile spalten={4} />}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {frageOffen && rueckgaengigFrage !== "" && (
        <Modal title="Rückgängig" onClose={() => setFrageOffen(false)} maxWidth="380px">
          <FrageModal frage={rueckgaengigFrage} onJa={handleRueckgaengigJa} onNein={() => setFrageOffen(false)} />
        </Modal>
      )}

      {agFrage && (
        <Modal title="Auf Seestation" onClose={() => setAgFrage(null)} maxWidth="380px" titelZentriert>
          <FrageModal
            zentriert
            frage={`${agFrage.traeger.lotsenName} kommt auf der Seestation an. Sollen die AG-Lotsen (${agFrage.agLotsen
              .map((a) => a.lotsenName)
              .join(", ")}) mit ausgeholt werden?`}
            onJa={() => setzeAufSeestation([agFrage.traeger.id, ...agFrage.agLotsen.map((a) => a.id)])}
            onNein={() => setzeAufSeestation([agFrage.traeger.id])}
          />
        </Modal>
      )}

      {bearbeiteAbteilung && (
        <Modal
          title={bearbeiteAbteilung.schiffsname ?? "Abteilung"}
          onClose={() => setBearbeiteAbteilung(null)}
          maxWidth="340px"
          titelZentriert
        >
          <AbteilungBearbeitenModal
            initial={{
              abteilZeit: bearbeiteAbteilung.abteilZeit,
              ankert: bearbeiteAbteilung.ankert ?? false,
              geschwindigkeitsklasse: bearbeiteAbteilung.geschwindigkeitsklasse ?? "normal",
            }}
            onUebernehmen={(wert) => {
              updateAbteilung(bearbeiteAbteilung.id, {
                abteilZeit: wert.abteilZeit,
                ankert: wert.ankert,
                geschwindigkeitsklasse: wert.geschwindigkeitsklasse,
              });
              // AG-Lotsen fahren auf demselben Schiff mit: Abt.Zeit, Speed
              // und Ankert-Status gelten für sie genauso, sonst liefen ihre
              // Ankunftszeiten auseinander (siehe lib/agKopplung.ts).
              for (const ag of gekoppelteAgAbteilungen(bearbeiteAbteilung, jobs, abteilungen)) {
                updateAbteilung(ag.id, {
                  abteilZeit: wert.abteilZeit,
                  ankert: wert.ankert,
                  geschwindigkeitsklasse: wert.geschwindigkeitsklasse,
                });
              }
              setBearbeiteAbteilung(null);
            }}
            onAbbrechen={() => setBearbeiteAbteilung(null)}
          />
        </Modal>
      )}
    </div>
  );
}
