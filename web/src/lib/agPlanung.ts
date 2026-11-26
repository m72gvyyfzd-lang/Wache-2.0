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
import { effektiveAnfahrtPauschaleMs, TENDER_VORLAUF_MS, planungsEta } from "./seestation";
import { MIN_TENDER_LOTSEN, berechneSeestationsDefizite, traegerLabel } from "./seestationBedarf";
import type { SeestationDefizit } from "./seestationBedarf";

export interface AgPlanungsGruppe {
  id: string;
  stufe: Exclude<MeldungsStufe, "alarm" | "info">;
  /** "AG" normalerweise, "AG (EHF)" wenn die Gruppe speziell einen
   *  EH-Engpass auf der Seestation deckt (siehe fehltEhBedingt). */
  typLabel: string;
  /** "MS TRAEGER (Abt. 21:36)" bzw. "Tender-AG bis 20:10" — bei AG (EHF)
   *  zusätzlich die namentlich vorgeschlagenen EH-Lotsen, sofern welche
   *  verfügbar sind. */
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
    typLabel: string,
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
        typLabel,
        empfehlung,
        anzahl,
        schiffsNamen: [schiffsname],
        fruehesteEta: eta,
        ueberWarteziel,
      });
    }
  }

  for (const d of defizite) {
    if (d.tenderEmpfehlung) continue; // Tender-Bedarfe werden unten zu Fahrten gebündelt
    // Der EH-bedingte Anteil des Defizits (siehe fehltEhBedingt) wird, so
    // weit er reicht, den Zuteilungen der Reihe nach entnommen und als
    // eigene "AG (EHF)"-Gruppe geführt — der Rest bleibt normale AG. Ein
    // Schiff mit z.B. 1 von 2 fehlenden Lotsen EH-bedingt erzeugt so zwei
    // Zeilen für denselben Träger statt einer unklar gemischten.
    let ehRest = d.fehltEhBedingt;
    let ehNamenRest = d.ehLotsenVorschlag;
    for (const z of d.zuteilungen) {
      const ehAnteil = Math.min(z.anzahl, ehRest);
      const regulaerAnteil = z.anzahl - ehAnteil;
      ehRest -= ehAnteil;
      if (ehAnteil > 0) {
        const namen = ehNamenRest.slice(0, ehAnteil);
        ehNamenRest = ehNamenRest.slice(ehAnteil);
        const zusatz = namen.length > 0 ? ` — z.B. ${namen.join(", ")}` : " — kein EH-Lotse an der Einsatzstation verfügbar!";
        const empfehlung = `${traegerLabel(z.traeger)} (Abt. ${formatUhrzeit(z.traeger.abteilzeit)})${zusatz}`;
        eintragen(
          `traeger-ehf-${z.traeger.eintrag.id}`,
          "AG (EHF)",
          empfehlung,
          ehAnteil,
          namen.length < ehAnteil ? "warnung" : d.stufe,
          d.schiff.schiffsname,
          planungsEta(d.schiff),
          z.ueberWarteziel,
        );
      }
      if (regulaerAnteil > 0) {
        const key = `traeger-${z.traeger.eintrag.id}`;
        const empfehlung = `${traegerLabel(z.traeger)} (Abt. ${formatUhrzeit(z.traeger.abteilzeit)})`;
        eintragen(key, "AG", empfehlung, regulaerAnteil, d.stufe, d.schiff.schiffsname, planungsEta(d.schiff), z.ueberWarteziel);
      }
    }
  }

  // --- Tender-Bedarfe zu FAHRTEN bündeln --------------------------------
  // Der Tender ist kein beliebig verfügbares Mittel: bestellen (3 Std.
  // Vorlauf), Lotsen aufnehmen, 3,5 Std. Anfahrt — die nächste Fahrt kann
  // frühestens ab Ankunft der vorherigen geplant werden (Abfahrt also
  // Ankunft + Vorlauf). Außerdem sollen mindestens 3 Lotsen pro Fahrt
  // mitfahren. Deshalb: Bedarfe aufsteigend nach ETA durchgehen und an die
  // laufende Fahrt hängen, solange sie noch zu klein ist ODER eine eigene
  // Fahrt nicht mehr rechtzeitig möglich wäre — die Lotsen warten dann auf
  // der Seestation. Die Abfahrt jeder Fahrt richtet sich nach ihrem
  // frühesten Schiff (spätestmöglich, um rechtzeitig dort zu sein).
  const tenderBedarf = defizite
    .filter((d): d is SeestationDefizit & { tenderEmpfehlung: NonNullable<SeestationDefizit["tenderEmpfehlung"]> } =>
      Boolean(d.tenderEmpfehlung),
    )
    .sort((a, b) => planungsEta(a.schiff).getTime() - planungsEta(b.schiff).getTime());
  const fahrten: { abfahrt: Date; anzahl: number; mitglieder: typeof tenderBedarf }[] = [];
  for (const d of tenderBedarf) {
    const letzte = fahrten[fahrten.length - 1];
    if (letzte) {
      const fruehesteNeueAbfahrt = letzte.abfahrt.getTime() + effektiveAnfahrtPauschaleMs() + TENDER_VORLAUF_MS;
      if (letzte.anzahl < MIN_TENDER_LOTSEN || fruehesteNeueAbfahrt > d.tenderEmpfehlung.abfahrt.getTime()) {
        letzte.mitglieder.push(d);
        letzte.anzahl += d.fehlt;
        continue;
      }
    }
    fahrten.push({ abfahrt: d.tenderEmpfehlung.abfahrt, anzahl: d.fehlt, mitglieder: [d] });
  }
  fahrten.forEach((fahrt, i) => {
    const planenBis = new Date(fahrt.abfahrt.getTime() - TENDER_VORLAUF_MS);
    // Tender-Fahrten bündeln mehrere Schiffe zu einer Fahrt — ein eventuell
    // EH-bedingter Anteil wird hier (anders als bei der Träger-Zuteilung
    // oben) nicht gesondert ausgewiesen; die EH-Pflicht gilt aber trotzdem
    // automatisch, sobald der Tender-AG-Job als "AG (EHF)" angelegt wird
    // (siehe lib/planungEinsatzstation.ts::eignungsWarnung).
    const empfehlung = `Tender (planen bis ${formatUhrzeit(planenBis)}, Abfahrt/Abt. ${formatUhrzeit(fahrt.abfahrt)})`;
    for (const d of fahrt.mitglieder) {
      eintragen(`tenderfahrt-${i}`, "AG", empfehlung, d.fehlt, d.stufe, d.schiff.schiffsname, planungsEta(d.schiff), false);
    }
  });

  return [...gruppen.values()].sort((a, b) => a.fruehesteEta.getTime() - b.fruehesteEta.getTime());
}
