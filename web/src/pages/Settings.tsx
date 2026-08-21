import { useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { Zeitrechnung } from "../components/Zeitrechnung";
import { handleZeitMitPrefill } from "../components/formShared";
import {
  ALARM_TOENE,
  ladeAlarmTonWahl,
  speichereAlarmTonWahl,
  spieleAlarmTon,
  spieleAlarmTonGeprueft,
  tonEntsperren,
  type AlarmTonName,
} from "../lib/alarmTon";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { useData } from "../state/DataContext";
import "./Settings.css";

function formatVNr(wert: number): string {
  return String(wert).padStart(3, "0");
}

export function Settings() {
  const { letzteVNr, setLetzteVNr, resetAlles, hwBrb, setHwBrb } = useData();
  const [eingabe, setEingabe] = useState(formatVNr(letzteVNr));
  const [resetFrage, setResetFrage] = useState(false);
  const [resetMeldung, setResetMeldung] = useState("");

  const [alarmTon, setAlarmTon] = useState<AlarmTonName>(() => ladeAlarmTonWahl());
  /** Rückmeldung des Probehörens — ohne sie bleibt unklar, ob der Ton
   *  stumm ist, weil der Browser ihn blockiert, oder weil das Gerät leise
   *  gestellt ist. */
  const [tonMeldung, setTonMeldung] = useState("");

  /** Auswahl speichern und sofort vorspielen — der Klick ins Dropdown ist
   *  zugleich die Nutzer-Interaktion, die den Ton freischaltet. */
  function handleAlarmTon(name: AlarmTonName) {
    setAlarmTon(name);
    speichereAlarmTonWahl(name);
    tonEntsperren();
    spieleAlarmTon(name);
  }

  async function handleTonTest() {
    tonEntsperren();
    const gespielt = await spieleAlarmTonGeprueft(alarmTon);
    setTonMeldung(
      gespielt
        ? "Ton läuft — hörst du nichts, ist das Gerät leise oder stumm geschaltet."
        : "Der Browser blockiert den Ton. Bitte die Seite einmal antippen und erneut probieren.",
    );
  }

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
    // resetAlles leert auch das gespeicherte HW-Paar — die lokalen
    // Formularfelder müssen mitziehen, sonst stünden die alten Zeiten noch
    // im Formular und würden beim nächsten Verlassen erneut gespeichert.
    setHw1Datum("");
    setHw1Zeit("");
    setHw2Datum("");
    setHw2Zeit("");
    setResetFrage(false);
    setResetMeldung(`Reset ausgeführt — alle Listen geleert, nächste V-Nr.: ${formatVNr(letzteVNr + 1)}.`);
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
      <div className="settings-row">
        <Panel title="Allgemein" className="settings-row__allgemein">
          <div className="settings-feld-spalte">
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
            <label className="settings-feld">
              Alarmton:
              <select value={alarmTon} onChange={(e) => handleAlarmTon(e.target.value as AlarmTonName)}>
                {ALARM_TOENE.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--small" title="Alarmton probehören" onClick={handleTonTest}>
                ▶
              </button>
            </label>
            {tonMeldung !== "" && <p className="settings-ton-hinweis">{tonMeldung}</p>}
          </div>
        </Panel>
        <Panel title="HW Brunsbüttel" className="settings-row__hw">
          <div className="settings-feld-spalte">
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
        <Panel title="Reset" className="settings-row__reset">
          <div className="settings-feld-zeile">
            <button type="button" className="btn btn--danger" onClick={() => setResetFrage(true)}>
              Alle Listen zurücksetzen
            </button>
            {resetMeldung && <span className="settings-meldung">{resetMeldung}</span>}
          </div>
        </Panel>
      </div>

      <Zeitrechnung />

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
