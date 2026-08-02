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
