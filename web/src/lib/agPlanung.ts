/**
 * AG-Planungs-Übersicht: fasst die einzelnen Seestations-Defizite (siehe
 * lib/seestationBedarf.ts) nach empfohlenem Träger zusammen, statt für
 * jedes betroffene Schiff eine eigene Zeile mit womöglich demselben Träger
 * zu zeigen. Echte Alarme (kein Träger/Tender mehr rechtzeitig möglich)
 * fließen hier NICHT ein — die bleiben als eigene, dringende Meldung
 * einzeln sichtbar (siehe lib/meldungen.ts).
 *
 * Gruppenschlüssel: die ID des empfohlenen Trägerjobs, ersatzweise "tender"
 * für Schiffe ohne passenden Träger, aber mit noch möglicher Tender-AG.
 * Innerhalb einer Gruppe gilt die höchste Einzelstufe (Warnung sticht
 * Vorschlag), Sortierung nach der frühesten betroffenen Schiffs-ETA.
 */
import type { AbteilzeitSettings } from "@wache/core";
import { formatUhrzeit } from "./format";
import type { MeldungsDaten, MeldungsStufe } from "./meldungen";
import { berechneSeestationsDefizite, traegerLabel } from "./seestationBedarf";

export interface AgPlanungsGruppe {
  id: string;
  stufe: Exclude<MeldungsStufe, "alarm" | "info">;
  /** "MS TRAEGER (Abt. 21:36)" bzw. "Tender-AG bis 20:10" */
  empfehlung: string;
  schiffsNamen: string[];
  fruehesteEta: Date;
}

export function berechneAgPlanung(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): AgPlanungsGruppe[] {
  const defizite = berechneSeestationsDefizite(daten, jetzt, settings).filter((d) => d.stufe !== "alarm");

  const gruppen = new Map<string, AgPlanungsGruppe>();
  for (const d of defizite) {
    const key = d.primaerTraeger ? `traeger-${d.primaerTraeger.eintrag.id}` : "tender";
    const empfehlung = d.primaerTraeger
      ? `${traegerLabel(d.primaerTraeger)} (Abt. ${formatUhrzeit(d.primaerTraeger.abteilzeit)})`
      : `Tender-AG bis ${formatUhrzeit(new Date(d.tenderFrist))}`;

    const bestehend = gruppen.get(key);
    if (bestehend) {
      bestehend.schiffsNamen.push(d.schiff.schiffsname);
      if (d.stufe === "warnung") bestehend.stufe = "warnung";
      if (d.schiff.eta.getTime() < bestehend.fruehesteEta.getTime()) bestehend.fruehesteEta = d.schiff.eta;
    } else {
      gruppen.set(key, {
        id: key,
        stufe: d.stufe as Exclude<MeldungsStufe, "alarm" | "info">,
        empfehlung,
        schiffsNamen: [d.schiff.schiffsname],
        fruehesteEta: d.schiff.eta,
      });
    }
  }

  return [...gruppen.values()].sort((a, b) => a.fruehesteEta.getTime() - b.fruehesteEta.getTime());
}
