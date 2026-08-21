import { describe, expect, it } from "vitest";
import { berechneAbteilzeit } from "../src/abteilzeit";
import { getAbteilzeitSettings } from "../src/settings";
import type { Job } from "../src/types";

const settings = getAbteilzeitSettings("Wechsel Tide");
const d = (iso: string) => new Date(iso);

function job(partial: Partial<Job>): Job {
  return { jobNr: 1, routentyp: "HH", ...partial };
}

describe("getAbteilzeitSettings (Wechsel Tide = Mittelwert Flut/Ebbe)", () => {
  it("berechnet HH-Offset korrekt in ganzen Minuten (3:14, nicht das Original-Artefakt 3:13)", () => {
    // Flut 3:29 + Ebbe 2:59 -> Mittel exakt 3:14. Die Original-Numbers-Datei zeigt
    // wegen eines Fließkomma-Rundungsfehlers 3:13 (siehe settings.ts Kommentar).
    expect(settings.hhAbteilung).toEqual({ stunden: 3, minuten: 14 });
  });

  it("liefert den matrix-angeglichenen Stade-Offset (1:30, Passage unkorrigiert)", () => {
    expect(settings.stadeAbteilung).toEqual({ stunden: 1, minuten: 30 });
  });

  it("berechnet FkW-Offset korrekt (2:45, hier stimmt auch das Original überein)", () => {
    expect(settings.fkwAbteilung).toEqual({ stunden: 2, minuten: 45 });
  });

  it("übernimmt Flut/Ebbe unverändert ohne Mittelwertbildung", () => {
    expect(getAbteilzeitSettings("Flut").hhAbteilung).toEqual({ stunden: 3, minuten: 29 });
    expect(getAbteilzeitSettings("Ebbe").hhAbteilung).toEqual({ stunden: 2, minuten: 59 });
  });
});

describe("berechneAbteilzeit — Route NOK", () => {
  it("nutzt Kuden-Passage + festen 1h-Offset, wenn vorhanden", () => {
    const j = job({ routentyp: "NOK", stadeKuden: d("2026-08-02T10:27:00Z") });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T11:27:00Z"));
  });

  it("fällt ohne Kuden-Zeit auf die (bereits geschätzte) Ticker/Abgang-Zeit zurück, ohne Offset", () => {
    const j = job({ routentyp: "NOK", fkwTickerAbgang: d("2026-08-02T11:45:00Z") });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T11:45:00Z"));
  });

  it("manueller Override sticht Checkpoints aus", () => {
    const j = job({
      routentyp: "NOK",
      stadeKuden: d("2026-08-02T10:27:00Z"),
      abteilungManuell: d("2026-08-02T12:00:00Z"),
    });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T12:00:00Z"));
  });
});

describe("berechneAbteilzeit — Route HH", () => {
  it("priorisiert Stade vor FkW vor HH/Holtenau", () => {
    const j = job({
      routentyp: "HH",
      hhHoltenau: d("2026-08-02T06:00:00Z"),
      fkwTickerAbgang: d("2026-08-02T09:00:00Z"),
      stadeKuden: d("2026-08-02T10:00:00Z"),
    });
    // Stade + 1:30
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T11:30:00Z"));
  });

  it("nutzt FkW + Offset, wenn Stade unbekannt ist", () => {
    const j = job({ routentyp: "HH", fkwTickerAbgang: d("2026-08-02T09:00:00Z") });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T11:45:00Z"));
  });

  it("nutzt HH/Holtenau + Offset, wenn nur diese Zeit bekannt ist", () => {
    const j = job({ routentyp: "HH", hhHoltenau: d("2026-08-02T06:00:00Z") });
    // Meldung − 15 (Meldeversatz) + 3:14
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T08:59:00Z"));
  });

  it("liefert undefined ohne jeden Checkpoint", () => {
    expect(berechneAbteilzeit(job({ routentyp: "HH" }), settings)).toBeUndefined();
  });
});

describe("berechneAbteilzeit — Route BÜTZ", () => {
  it("nutzt Stade + Stade-Offset, wenn vorhanden", () => {
    const j = job({ routentyp: "BÜTZ", stadeKuden: d("2026-08-02T10:00:00Z") });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T11:30:00Z"));
  });

  it("addiert bei FkW-Fallback zusätzlich den 29-Minuten-Zuschlag", () => {
    const j = job({ routentyp: "BÜTZ", fkwTickerAbgang: d("2026-08-02T09:00:00Z") });
    // 09:00 + 0:29 + 1:30 = 10:59
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T10:59:00Z"));
  });
});

describe("berechneAbteilzeit — sonstige Routentypen", () => {
  it("nutzt bei unbekannter Route ausschließlich den manuellen Wert", () => {
    const j = job({ routentyp: "AG", abteilungManuell: d("2026-08-02T12:00:00Z") });
    expect(berechneAbteilzeit(j, settings)).toEqual(d("2026-08-02T12:00:00Z"));
  });

  it("liefert undefined bei unbekannter Route ohne manuellen Wert", () => {
    expect(berechneAbteilzeit(job({ routentyp: "AG" }), settings)).toBeUndefined();
  });
});
