/** Gemeinsame Bausteine der drei Job-Bearbeitungsformulare und des
 *  Lotsen-Formulars. */
import { useState } from "react";
import { SCHIFFS_KATEGORIEN } from "@wache/core";
import { formatUhrzeit } from "../lib/format";

interface SchiffKatSelectProps {
  value: string;
  onChange: (wert: string) => void;
}

export function SchiffKatSelect({ value, onChange }: SchiffKatSelectProps) {
  return (
    <label>
      Kat.
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">–</option>
        {SCHIFFS_KATEGORIEN.map((kat) => (
          <option key={kat} value={kat}>
            {kat}
          </option>
        ))}
      </select>
    </label>
  );
}

interface AbtZeitAnzeigeProps {
  /** effektive Abteilzeit (bei gesetztem Override bereits der Override) */
  wert: Date | undefined;
  /** true, wenn der Wert aus "man. Abt.Zeit" stammt → dezent rot hinterlegen */
  manuellAktiv: boolean;
}

export function AbtZeitAnzeige({ wert, manuellAktiv }: AbtZeitAnzeigeProps) {
  return (
    <label>
      Abt. Zeit
      <output className={"job-form__abtzeit" + (manuellAktiv ? " job-form__abtzeit--manuell" : "")}>
        {formatUhrzeit(wert)}
      </output>
    </label>
  );
}

interface FormActionsProps {
  /** nur beim Bearbeiten gesetzt — löst die Löschen-Bestätigung aus */
  onDelete?: () => void;
  onCancel: () => void;
}

export function FormActions({ onDelete, onCancel }: FormActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="job-form__actions">
      {onDelete &&
        (confirmDelete ? (
          <span className="job-form__confirm">
            Wirklich löschen?
            <button type="button" className="btn btn--small btn--danger" onClick={onDelete}>
              Ja, löschen
            </button>
            <button type="button" className="btn btn--small" onClick={() => setConfirmDelete(false)}>
              Nein
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            Löschen
          </button>
        ))}
      <span className="job-form__spacer" />
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Abbrechen
      </button>
      <button type="submit" className="btn btn--accent">
        Speichern
      </button>
    </div>
  );
}
