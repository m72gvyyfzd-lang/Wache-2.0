/** Konvertiert zwischen Date und dem Format, das <input type="datetime-local">
 *  erwartet ("YYYY-MM-DDTHH:mm", lokale Zeit ohne Zeitzone). */
export function toLocalInput(datum: Date | undefined): string {
  if (!datum) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${datum.getFullYear()}-${pad(datum.getMonth() + 1)}-${pad(datum.getDate())}T${pad(datum.getHours())}:${pad(datum.getMinutes())}`;
}

export function fromLocalInput(wert: string): Date | undefined {
  if (!wert) return undefined;
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? undefined : datum;
}

/** Nur die Uhrzeit für <input type="time"> ("HH:mm", lokale Zeit). */
export function toLocalTimeInput(datum: Date | undefined): string {
  if (!datum) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(datum.getHours())}:${pad(datum.getMinutes())}`;
}

/** Nur das Datum für <input type="date"> ("YYYY-MM-DD", lokale Zeit). */
export function toLocalDateInput(datum: Date | undefined): string {
  if (!datum) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${datum.getFullYear()}-${pad(datum.getMonth() + 1)}-${pad(datum.getDate())}`;
}

/** Führt getrennte Datum-/Zeit-Eingaben (aus type="date" + type="time")
 *  wieder zu einem Date zusammen. */
export function ausDatumUndZeit(datum: string, zeit: string): Date | undefined {
  if (!datum || !zeit) return undefined;
  const ergebnis = new Date(`${datum}T${zeit}`);
  return Number.isNaN(ergebnis.getTime()) ? undefined : ergebnis;
}
