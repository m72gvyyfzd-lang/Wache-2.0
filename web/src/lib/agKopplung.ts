/**
 * Kopplung zwischen einem Trägerschiff und seinen AG-Lotsen.
 *
 * Ein AG-Job hängt über `agJobId` am Job des Trägerschiffs — die AG-Lotsen
 * fahren also auf demselben Schiff mit. Alles, was die Fahrt dieses
 * Schiffes betrifft, gilt deshalb für sie genauso: dieselbe
 * Geschwindigkeit (und damit dieselbe Ankunft auf der Seestation),
 * derselbe Ankert-Status, dieselbe Ankunft "Auf Seestation".
 *
 * Die Kopplung wird bewusst NICHT automatisch bei jeder Änderung
 * erzwungen, sondern dort angewandt, wo der Nutzer eine Fahrt-Eigenschaft
 * des Trägers ändert (Speed/Ankert in der Versetzliste) oder ihn als
 * angekommen meldet — beim Ankommen mit Rückfrage, weil AG-Lotsen
 * gelegentlich an Bord bleiben.
 */
import type { Abteilung, JobEintrag } from "../data/types";
import { istAgJob } from "./coreJob";

/**
 * Die Abteilungen der AG-Lotsen, die am selben Schiff hängen wie die
 * übergebene Träger-Abteilung. Leer, wenn der Job kein Träger ist (oder
 * selbst ein AG-Job) — dann gibt es nichts zu koppeln.
 */
export function gekoppelteAgAbteilungen(
  traeger: Abteilung,
  jobs: JobEintrag[],
  abteilungen: Abteilung[],
): Abteilung[] {
  const traegerJob = jobs.find((j) => j.id === traeger.jobId);
  // Ein AG-Job ist nie selbst Träger — sonst hinge eine AG an einer AG.
  if (traegerJob === undefined || istAgJob(traegerJob)) return [];
  const agJobIds = new Set(jobs.filter((j) => istAgJob(j) && j.agJobId === traeger.jobId).map((j) => j.id));
  if (agJobIds.size === 0) return [];
  return abteilungen.filter((a) => a.id !== traeger.id && agJobIds.has(a.jobId));
}
