import { describe, expect, it } from "vitest";
import { berechneAmpelstatus, berechneAnrufzeit, berechneKatCheck, naechsteAufrufnummer } from "../src/anruf";
import { getAbteilzeitSettings } from "../src/settings";
import type { Job, Lotse } from "../src/types";

const settings = getAbteilzeitSettings("Wechsel Tide");
const d = (iso: string) => new Date(iso);

function lotse(partial: Partial<Lotse>): Lotse {
  return { name: "Test, Pilot", ehfQualifiziert: false, abgerufen: false, ...partial };
}

function job(partial: Partial<Job>): Job {
  return { jobNr: 1, routentyp: "HH", ...partial };
}

describe("berechneAnrufzeit", () => {
  it("zieht den Standard-Vorlauf von 1h von der Abteilzeit ab", () => {
    const j = job({ stadeKuden: d("2026-08-02T10:00:00Z") }); // Abteilzeit 11:05
    const l = lotse({ jobNr: 1 });
    expect(berechneAnrufzeit(l, j, settings)).toEqual(d("2026-08-02T10:05:00Z"));
  });

  it("nutzt individuellen Vorlauf aus Dezimalstunden (1.5 = 1h30)", () => {
    const j = job({ stadeKuden: d("2026-08-02T10:00:00Z") }); // Abteilzeit 11:05
    const l = lotse({ jobNr: 1, vorlaufStunden: 1.5 });
    expect(berechneAnrufzeit(l, j, settings)).toEqual(d("2026-08-02T09:35:00Z"));
  });

  it("liefert undefined ohne zugeordneten Job", () => {
    expect(berechneAnrufzeit(lotse({}), undefined, settings)).toBeUndefined();
  });

  it.each(["2+2", "1+1"])("liefert undefined für Sonder-Wachblöcke (%s)", (routentyp) => {
    const j = job({ routentyp, stadeKuden: d("2026-08-02T10:00:00Z") });
    const l = lotse({ jobNr: 1 });
    expect(berechneAnrufzeit(l, j, settings)).toBeUndefined();
  });

  it("liefert undefined, wenn die Abteilzeit selbst nicht berechenbar ist", () => {
    const j = job({}); // kein Checkpoint gesetzt
    const l = lotse({ jobNr: 1 });
    expect(berechneAnrufzeit(l, j, settings)).toBeUndefined();
  });
});

describe("berechneAmpelstatus", () => {
  const jetzt = d("2026-08-02T10:00:00Z");

  it('zeigt "✅" wenn bereits abgerufen', () => {
    expect(berechneAmpelstatus(lotse({ abgerufen: true }), d("2026-08-02T09:00:00Z"), jetzt)).toBe("✅");
  });

  it('zeigt "! abrufen !" wenn die Anrufzeit erreicht ist und noch nicht abgerufen wurde', () => {
    expect(berechneAmpelstatus(lotse({ abgerufen: false }), d("2026-08-02T09:59:00Z"), jetzt)).toBe(
      "! abrufen !",
    );
  });

  it("zeigt nichts an, solange die Anrufzeit noch in der Zukunft liegt", () => {
    expect(berechneAmpelstatus(lotse({ abgerufen: false }), d("2026-08-02T10:01:00Z"), jetzt)).toBe("");
  });

  it("zeigt nichts an ohne berechenbare Anrufzeit", () => {
    expect(berechneAmpelstatus(lotse({}), undefined, jetzt)).toBe("");
  });
});

describe("berechneKatCheck", () => {
  it('warnt "! ! !" wenn die Job-Kategorie höher ist als die Lotsenkategorie', () => {
    const j = job({ kategorie: 5 });
    const l = lotse({ jobNr: 1, eigeneKategorie: 3 });
    expect(berechneKatCheck(l, j)).toBe("! ! !");
  });

  it("keine Warnung, wenn die Lotsenkategorie ausreicht", () => {
    const j = job({ kategorie: 5 });
    const l = lotse({ jobNr: 1, eigeneKategorie: 6 });
    expect(berechneKatCheck(l, j)).toBe("");
  });

  it("behandelt ein leeres Lotsen-Kategoriefeld als voll qualifiziert (Default 8)", () => {
    const j = job({ kategorie: 7 });
    const l = lotse({ jobNr: 1 });
    expect(berechneKatCheck(l, j)).toBe("");
  });

  it("behandelt Text-Job-Kategorien (Sonderkategorie) wie Kategorie 8 (höchste Stufe)", () => {
    const j = job({ kategorie: "AGF3/7" });
    // Lotse mit leerem (=Default 8) Feld ist qualifiziert...
    expect(berechneKatCheck(lotse({ jobNr: 1 }), j)).toBe("");
    // ...ein Lotse mit explizit niedrigerer eigener Kategorie dagegen nicht.
    expect(berechneKatCheck(lotse({ jobNr: 1, eigeneKategorie: 1 }), j)).toBe("! ! !");
  });

  it('warnt "EHF!" bei EHF(LNG)-Job ohne Qualifikation', () => {
    const j = job({ routentyp: "EHF (LNG)" });
    const l = lotse({ jobNr: 1, ehfQualifiziert: false });
    expect(berechneKatCheck(l, j)).toBe("EHF!");
  });

  it("keine Warnung bei EHF(LNG)-Job mit Qualifikation", () => {
    const j = job({ routentyp: "EHF (LNG)" });
    const l = lotse({ jobNr: 1, ehfQualifiziert: true });
    expect(berechneKatCheck(l, j)).toBe("");
  });
});

describe("naechsteAufrufnummer", () => {
  it("zählt hoch, wenn abgerufen", () => {
    expect(naechsteAufrufnummer({ abgerufen: true }, false, 921)).toBe(922);
  });

  it("zählt hoch im Preview-Modus, auch ohne Abruf", () => {
    expect(naechsteAufrufnummer({ abgerufen: false }, true, 921)).toBe(922);
  });

  it("bleibt unverändert (undefined), wenn weder abgerufen noch Preview", () => {
    expect(naechsteAufrufnummer({ abgerufen: false }, false, 921)).toBeUndefined();
  });
});
