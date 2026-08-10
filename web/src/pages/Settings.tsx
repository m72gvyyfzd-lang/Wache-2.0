import { useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { handleZeitMitPrefill } from "../components/formShared";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { zufaelligeLotsen, zufaelligeSeeSchiffe } from "../lib/testdaten";
import { useData } from "../state/DataContext";
import "./Settings.css";

function formatVNr(wert: number): string {
  return String(wert).padStart(3, "0");
}

export function Settings() {
  const { letzteVNr, setLetzteVNr, addLotse, addSeeSchiff, resetAlles, hwBrb, setHwBrb } = useData();
  const [eingabe, setEingabe] = useState(formatVNr(letzteVNr));
  const [testMeldung, setTestMeldung] = useState("");
  const [resetFrage, setResetFrage] = useState(false);
  const [resetMeldung, setResetMeldung] = useState("");

  const [hw1Datum, setHw1Datum] = useState(toLocalDateInput(hwBrb.hw1));
  const [hw1Zeit, setHw1Zeit] = useState(toLocalTimeInput(hwBrb.hw1));
  const [hw2Datum, setHw2Datum] = useState(toLocalDateInput(hwBrb.hw2));
  const [hw2Zeit, setHw2Zeit] = useState(toLocalTimeInput(hwBrb.hw2));

  /** Beim Verlassen eines HW-Felds den aktuellen Stand aller vier Teilfelder
   *  als HW-Paar übernehmen (nicht bei jedem Tastendruck — halbe Uhrzeiten
   *  würden sonst schon als HW gespeichert). */
  function uebernimmHw() {
    setHwBrb({
      hw1: ausDatumUndZeit(hw1Datum, hw1Zeit),
      hw2: ausDatumUndZeit(hw2Datum, hw2Zeit),
    });
  }

  function handleResetJa() {
    resetAlles();
    setResetFrage(false);
    setTestMeldung("");
    setResetMeldung(`Reset ausgeführt — alle Listen geleert, nächste V-Nr.: ${formatVNr(letzteVNr + 1)}.`);
  }

  function handleTestLotsen() {
    for (const lotse of zufaelligeLotsen(20)) addLotse(lotse);
    setTestMeldung("20 Lotsen eingefügt (Einsatzstation, Lotsenliste).");
  }

  function handleTestSchiffe() {
    for (const schiff of zufaelligeSeeSchiffe(20)) addSeeSchiff(schiff);
    setTestMeldung("20 Schiffe eingefügt (Seestation, ETA-Liste).");
  }

  function handleChange(wert: string) {
    setEingabe(wert.replace(/\D/g, "").slice(0, 3));
  }

  /** Pflichtfeld: bei leerem Feld beim Verlassen auf den letzten gültigen
   *  Wert zurückfallen statt einen leeren Zustand zuzulassen. */
  function handleBlur() {
    if (eingabe === "") {
      setEingabe(formatVNr(letzteVNr));
      return;
    }
    const zahl = Number(eingabe);
    setLetzteVNr(zahl);
    setEingabe(formatVNr(zahl));
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <Panel title="Allgemein">
        <div className="settings-feld-zeile">
          <label className="settings-feld">
            letzte V-Nr.:
            <input
              type="text"
              inputMode="numeric"
              required
              value={eingabe}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
            />
          </label>
        </div>
      </Panel>
      <Panel
        title="HW Brunsbüttel"
        description="Die nächsten beiden Hochwasser Brunsbüttel. Sobald HW 1 gesetzt ist, berechnen HH-Jobs mit FkW- oder Stade-Meldung ihre Abteilzeit über die Tiden-Matrix (Ankunft Brücke − 20 min) statt über die festen Offsets."
      >
        <div className="settings-feld-zeile">
          <label className="settings-feld">
            HW 1:
            <input
              type="time"
              className="settings-feld__zeit"
              value={hw1Zeit}
              onChange={(e) => handleZeitMitPrefill(e.target.value, hw1Datum, setHw1Zeit, setHw1Datum)}
              onBlur={uebernimmHw}
            />
            <input
              type="date"
              className="settings-feld__datum"
              value={hw1Datum}
              onChange={(e) => setHw1Datum(e.target.value)}
              onBlur={uebernimmHw}
            />
          </label>
          <label className="settings-feld">
            HW 2:
            <input
              type="time"
              className="settings-feld__zeit"
              value={hw2Zeit}
              onChange={(e) => handleZeitMitPrefill(e.target.value, hw2Datum, setHw2Zeit, setHw2Datum)}
              onBlur={uebernimmHw}
            />
            <input
              type="date"
              className="settings-feld__datum"
              value={hw2Datum}
              onChange={(e) => setHw2Datum(e.target.value)}
              onBlur={uebernimmHw}
            />
          </label>
        </div>
      </Panel>
      <Panel title="Testdaten" description="Fügt zufällig erzeugte Einträge zum Testen hinzu (bestehende Daten bleiben erhalten).">
        <div className="settings-feld-zeile">
          <button type="button" className="btn btn--accent" onClick={handleTestLotsen}>
            + 20 zufällige Lotsen (Einsatzstation)
          </button>
          <button type="button" className="btn btn--accent" onClick={handleTestSchiffe}>
            + 20 zufällige Schiffe (Seestation ETA-Liste)
          </button>
          {testMeldung && <span className="settings-testdaten-meldung">{testMeldung}</span>}
        </div>
      </Panel>
      <Panel
        title="Reset"
        description="Leert alle Listen (Tafel Brb, Lotsenliste, Versetzlisten, Seestation) und setzt die V-Nr.-Zählung auf den Settings-Wert zurück. Die Einstellungen selbst bleiben erhalten."
      >
        <div className="settings-feld-zeile">
          <button type="button" className="btn btn--danger" onClick={() => setResetFrage(true)}>
            Alle Listen zurücksetzen
          </button>
          {resetMeldung && <span className="settings-testdaten-meldung">{resetMeldung}</span>}
        </div>
      </Panel>

      {resetFrage && (
        <Modal title="Reset" onClose={() => setResetFrage(false)} maxWidth="420px" titelZentriert>
          <FrageModal
            frage={`Bist du sicher? Alle Listen werden unwiderruflich geleert. Die V-Nr.-Zählung beginnt danach wieder bei ${formatVNr(letzteVNr + 1)}.`}
            zentriert
            onJa={handleResetJa}
            onNein={() => setResetFrage(false)}
          />
        </Modal>
      )}
    </div>
  );
}
