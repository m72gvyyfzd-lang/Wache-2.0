import { useState } from "react";
import "./JobForm.css";
import "./ManagePilotModal.css";

type Modus = "tauschen" | "verschieben" | null;

interface AndererLotse {
  index: number;
  name: string;
}

interface ManagePilotModalProps {
  andere: AndererLotse[];
  onBearbeiten: () => void;
  onTauschen: (zielIndex: number) => void;
  onVerschieben: (zielIndex: number) => void;
  onAbbrechen: () => void;
}

export function ManagePilotModal({ andere, onBearbeiten, onTauschen, onVerschieben, onAbbrechen }: ManagePilotModalProps) {
  const [modus, setModus] = useState<Modus>(null);
  const [ziel, setZiel] = useState("");

  function toggleModus(neu: Exclude<Modus, null>) {
    setModus((aktuell) => (aktuell === neu ? null : neu));
    setZiel("");
  }

  function handleOk() {
    if (ziel === "") return;
    const zielIndex = Number(ziel);
    if (modus === "tauschen") onTauschen(zielIndex);
    if (modus === "verschieben") onVerschieben(zielIndex);
  }

  return (
    <div className="job-form">
      <div className="manage-pilot__aktionen">
        <button type="button" className="btn" onClick={onBearbeiten}>
          Bearbeiten
        </button>
        <button
          type="button"
          className={"btn" + (modus === "tauschen" ? " btn--accent" : "")}
          onClick={() => toggleModus("tauschen")}
        >
          Tauschen
        </button>
        <button
          type="button"
          className={"btn" + (modus === "verschieben" ? " btn--accent" : "")}
          onClick={() => toggleModus("verschieben")}
        >
          Verschieben
        </button>
      </div>

      {/* Ebene 2 bleibt im Layout vorhanden (nur unsichtbar), damit das
          Fenster beim Umschalten nicht die Höhe ändert. */}
      <div className={"job-form__row" + (modus === null ? " job-form__verborgen" : "")}>
        <label className="job-form__grow2">
          {modus === "verschieben" ? "Einfügen hinter…" : "Tauschen mit…"}
          <select value={ziel} onChange={(e) => setZiel(e.target.value)}>
            <option value="">–</option>
            {andere.map((eintrag) => (
              <option key={eintrag.index} value={eintrag.index}>
                {eintrag.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--accent" disabled={ziel === ""} onClick={handleOk}>
          OK
        </button>
      </div>

      <div className="job-form__actions">
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
