/** Gemeinsame Bausteine der drei Job-Bearbeitungsformulare und des
 *  Lotsen-Formulars. */
import { useState } from "react";
import { SCHIFFS_KATEGORIEN, type Geschwindigkeitsklasse } from "@wache/core";
import { formatUhrzeit } from "../lib/format";
import { toLocalDateInput } from "../lib/datetime";

interface SchiffKatSelectProps {
  value: string;
  onChange: (wert: string) => void;
  className?: string;
  /** Pflichtfeld: der leere Eintrag "–" blockiert dann das Speichern
   *  (native Formular-Validierung). */
  required?: boolean;
}

export function SchiffKatSelect({ value, onChange, className, required }: SchiffKatSelectProps) {
  return (
    <label className={className}>
      Kat.
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
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

interface SpeedSelectProps {
  value: Geschwindigkeitsklasse;
  onChange: (wert: Geschwindigkeitsklasse) => void;
  className?: string;
}

/** Geschwindigkeitsklasse für die Tiden-Matrix (Brb-Abteilzeit + Brb>>SEE).
 *  Kurzlabels ohne kn-Angabe — die Klassen stehen fest für 9 / 11,5 / 14 kn. */
const SPEED_LABELS: Record<Geschwindigkeitsklasse, string> = {
  langsam: "slow",
  normal: "normal",
  schnell: "fast",
};

export function SpeedSelect({ value, onChange, className }: SpeedSelectProps) {
  return (
    <label className={className}>
      Speed
      <select value={value} onChange={(e) => onChange(e.target.value as Geschwindigkeitsklasse)}>
        {(Object.keys(SPEED_LABELS) as Geschwindigkeitsklasse[]).map((klasse) => (
          <option key={klasse} value={klasse}>
            {SPEED_LABELS[klasse]}
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

/** Bemerkungs-Token (z.B. "Bütz", "Bunkert") idempotent entfernen. */
export function ohneToken(text: string, token: string): string {
  return text
    .split(/\s+/)
    .filter((t) => t !== token)
    .join(" ");
}

/** Bemerkungs-Token idempotent anhängen. */
export function mitToken(text: string, token: string): string {
  return text.split(/\s+/).includes(token) ? text : text ? `${text} ${token}` : token;
}

/** Uhrzeit setzen und dabei automatisch das heutige Datum vorbelegen, sobald
 *  zum ersten Mal eine Uhrzeit ohne zugehöriges Datum eingetragen wird —
 *  verhindert eine "schwebende" Uhrzeit ohne Tagesbezug. Greift nur beim
 *  Wechsel von leer auf gesetzt; ein bereits vorhandenes (ggf. abweichendes)
 *  Datum bleibt unangetastet. */
export function handleZeitMitPrefill(
  wert: string,
  datumWert: string,
  setZeit: (wert: string) => void,
  setDatum: (wert: string) => void,
) {
  setZeit(wert);
  if (wert !== "" && datumWert === "") setDatum(toLocalDateInput(new Date()));
}

function KalenderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 1v3M11.5 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface DatumToggleButtonProps {
  offen: boolean;
  onClick: () => void;
}

/** Blendet die Datumszeile (Ebene 3) der HH-/NOK-Formulare ein/aus — die
 *  Uhrzeiten selbst bleiben immer sichtbar, das Datum braucht man nur bei
 *  einem vom heutigen Tag abweichenden Termin. */
export function DatumToggleButton({ offen, onClick }: DatumToggleButtonProps) {
  return (
    <button
      type="button"
      className={"job-form__datum-toggle" + (offen ? " job-form__datum-toggle--aktiv" : "")}
      onClick={onClick}
      aria-pressed={offen}
      title={offen ? "Datumsfelder ausblenden" : "Datumsfelder einblenden"}
    >
      <KalenderIcon />
    </button>
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
