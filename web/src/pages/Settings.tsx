import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { useData } from "../state/DataContext";
import "./Settings.css";

function formatVNr(wert: number): string {
  return String(wert).padStart(3, "0");
}

export function Settings() {
  const { letzteVNr, setLetzteVNr } = useData();
  const [eingabe, setEingabe] = useState(formatVNr(letzteVNr));

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
    </div>
  );
}
