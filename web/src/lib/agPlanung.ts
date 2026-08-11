/**
 * AG-Planungs-Übersicht: fasst die einzelnen Seestations-Defizite (siehe
 * lib/seestationBedarf.ts) nach empfohlenem Träger zusammen, statt für
 * jedes betroffene Schiff eine eigene Zeile mit womöglich demselben Träger
 * zu zeigen. Echte Alarme (kein Träger/Tender mehr rechtzeitig möglich)
 * fließen hier NICHT ein — die bleiben als eigene, dringende Meldung
 * einzeln sichtbar (siehe lib/meldungen.ts).
 *
 * Ein Schiff kann jetzt auf MEHRERE Träger aufgeteilt sein (siehe
 * lib/seestationBedarf.ts::planeAgTraeger, ab 4 fehlenden Lotsen und wenn
 * ein zweiter Träger existiert) — jede Zuteilung landet einzeln in ihrer
 * Trägergruppe. Gruppenschlüssel: die ID des Trägerjobs, ersatzweise
 * "tender" für Schiffe ohne passenden Träger, aber mit noch möglicher
 * Tender-AG. Innerhalb einer Gruppe gilt die höchste Einzelstufe (Warnung
 * sticht Vorschlag), Sortierung nach der frühesten betroffenen Schiffs-ETA.
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
  /** Summe der AG-Lotsen, die über diesen Träger fahren sollen */
  anzahl: number;
  schiffsNamen: string[];
  fruehesteEta: Date;
  /** true, sobald mind. eine Zuteilung der Gruppe über dem 6-Std.-Warteziel liegt */
  ueberWarteziel: boolean;
}

export function berechneAgPlanung(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): AgPlanungsGruppe[] {
  const defizite = berechneSeestationsDefizite(daten, jetzt, settings).filter((d) => d.stufe !== "alarm");

  const gruppen = new Map<string, AgPlanungsGruppe>();
  function eintragen(
    key: string,
    empfehlung: string,
    anzahl: number,
    stufe: MeldungsStufe,
    schiffsname: string,
    eta: Date,
    ueberWarteziel: boolean,
  ) {
    const bestehend = gruppen.get(key);
    if (bestehend) {
      bestehend.anzahl += anzahl;
      bestehend.schiffsNamen.push(schiffsname);
      if (stufe === "warnung") bestehend.stufe = "warnung";
      if (eta.getTime() < bestehend.fruehesteEta.getTime()) bestehend.fruehesteEta = eta;
      bestehend.ueberWarteziel = bestehend.ueberWarteziel || ueberWarteziel;
    } else {
      gruppen.set(key, {
        id: key,
        stufe: stufe as Exclude<MeldungsStufe, "alarm" | "info">,
        empfehlung,
        anzahl,
        schiffsNamen: [schiffsname],
        fruehesteEta: eta,
        ueberWarteziel,
      });
    }
  }

  for (const d of defizite) {
    if (d.zuteilungen.length === 0) {
      eintragen(
        "tender",
        `Tender-AG bis ${formatUhrzeit(new Date(d.tenderFrist))}`,
        d.fehlt,
        d.stufe,
        d.schiff.schiffsname,
        d.schiff.eta,
        false,
      );
      continue;
    }
    for (const z of d.zuteilungen) {
      const key = `traeger-${z.traeger.eintrag.id}`;
      const empfehlung = `${traegerLabel(z.traeger)} (Abt. ${formatUhrzeit(z.traeger.abteilzeit)})`;
      eintragen(key, empfehlung, z.anzahl, d.stufe, d.schiff.schiffsname, d.schiff.eta, z.ueberWarteziel);
    }
  }

  return [...gruppen.values()].sort((a, b) => a.fruehesteEta.getTime() - b.fruehesteEta.getTime());
}
