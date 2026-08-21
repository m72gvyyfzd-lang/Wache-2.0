/** Gemeinsamer Hook für die Meldungs-Engine: berechnet die aktuellen
 *  Meldungen (mit 15-s-Zeit-Tick) und ihre Gruppierung. Genutzt vom
 *  Dashboard (Alarm-Kachel + Ton) und von der Navigation (rote/orange
 *  Ränder an den betroffenen Nav-Knöpfen). */
import { useEffect, useMemo, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { berechneMeldungen, gruppiereMeldungen } from "../lib/meldungen";
import type { Meldung, MeldungsGruppe } from "../lib/meldungen";
import { useData } from "./DataContext";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function useMeldungen(): { meldungen: Meldung[]; gruppen: MeldungsGruppe[]; jetzt: Date } {
  const { jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn } =
    useData();

  // Zeit-Tick: die Meldungen hängen an der Uhrzeit (gepl. Abruf etc.) und
  // werden daher regelmäßig neu berechnet, auch ohne Datenänderung.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const meldungen = useMemo(
    () =>
      berechneMeldungen(
        { jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn },
        jetzt,
        settings,
      ),
    [jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn, jetzt],
  );
  const gruppen = useMemo(() => gruppiereMeldungen(meldungen), [meldungen]);

  return { meldungen, gruppen, jetzt };
}
