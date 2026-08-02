export function formatUhrzeit(datum: Date | undefined): string {
  if (!datum) return "–";
  return datum.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export type Herkunft = "HH" | "NOK" | "Anmeldung";

/** Grobe Anzeige-Kategorie eines Jobs, abgeleitet vom Routentyp. Rein für
 *  die Darstellung — die core-Algorithmen unterscheiden nur NOK/HH/BÜTZ
 *  vs. alles andere. */
export function herkunftVon(routentyp: string): Herkunft {
  if (routentyp === "HH") return "HH";
  if (routentyp === "NOK") return "NOK";
  return "Anmeldung";
}
