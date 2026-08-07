import { describe, expect, it } from "vitest";
import {
  darfFahren,
  darfJobTyp,
  darfZweiterLotse,
  hatDreiPlus,
  lotsenRang,
  schiffsRang,
} from "../src/kategorien";

describe("Ränge", () => {
  it("Volllotse (leer) hat Rang 8", () => {
    expect(lotsenRang("")).toBe(8);
    expect(lotsenRang(undefined)).toBe(8);
  });

  it("3+ zählt im Schiffsvergleich wie Kat. 3", () => {
    expect(lotsenRang("3+")).toBe(3);
  });

  it("jede AGF-Kategorie entspricht Schiffsrang 8", () => {
    expect(schiffsRang("AGF 1")).toBe(8);
    expect(schiffsRang("AGF 3/7")).toBe(8);
    expect(schiffsRang("AGF 3+")).toBe(8);
    expect(schiffsRang("7")).toBe(7);
  });
});

describe("darfFahren (1. Lotse)", () => {
  it("Lotse braucht gleiche oder höhere Kat. als das Schiff", () => {
    expect(darfFahren("4", "3")).toBe(false); // Beispiel aus der Spezifikation
    expect(darfFahren("4", "4")).toBe(true);
    expect(darfFahren("4", "7")).toBe(true);
  });

  it("Volllotsen dürfen jeden Job machen", () => {
    expect(darfFahren("7", "")).toBe(true);
    expect(darfFahren("AGF 3", "")).toBe(true);
    expect(darfFahren("AGF 3+", "")).toBe(true);
  });

  it("AGF ohne /7 darf nur der Volllotse fahren", () => {
    expect(darfFahren("AGF 2", "7")).toBe(false);
    expect(darfFahren("AGF 2", "")).toBe(true);
  });

  it("AGF mit /7 darf auch ein Kat.-7-Lotse fahren", () => {
    expect(darfFahren("AGF 2/7", "7")).toBe(true);
    expect(darfFahren("AGF 2/7", "6")).toBe(false);
    expect(darfFahren("AGF 3/7", "3+")).toBe(false);
  });

  it("3+ zählt beim Schiffsvergleich wie 3", () => {
    expect(darfFahren("3", "3+")).toBe(true);
    expect(darfFahren("4", "3+")).toBe(false);
  });
});

describe("hatDreiPlus / min. Kat. 3+", () => {
  it("3+ und alles darüber erfüllen, Kat. 3 nicht", () => {
    expect(hatDreiPlus("3+")).toBe(true);
    expect(hatDreiPlus("4")).toBe(true);
    expect(hatDreiPlus("7")).toBe(true);
    expect(hatDreiPlus("")).toBe(true);
    expect(hatDreiPlus("3")).toBe(false);
    expect(hatDreiPlus("1")).toBe(false);
  });
});

describe("darfZweiterLotse", () => {
  it("AGF (außer 3+): 2. Lotse min. Kat. 3+", () => {
    expect(darfZweiterLotse("AGF 2", "3+")).toBe(true);
    expect(darfZweiterLotse("AGF 2", "4")).toBe(true);
    expect(darfZweiterLotse("AGF 2", "")).toBe(true);
    expect(darfZweiterLotse("AGF 2", "3")).toBe(false);
    expect(darfZweiterLotse("AGF 1/7", "3+")).toBe(true);
  });

  it("AGF 3+: 2. Lotse min. Kat. 6", () => {
    expect(darfZweiterLotse("AGF 3+", "6")).toBe(true);
    expect(darfZweiterLotse("AGF 3+", "7")).toBe(true);
    expect(darfZweiterLotse("AGF 3+", "")).toBe(true);
    expect(darfZweiterLotse("AGF 3+", "5")).toBe(false);
    expect(darfZweiterLotse("AGF 3+", "3+")).toBe(false);
  });

  it("Kat.-1–7-Schiff: 2. Lotse braucht nur eigene Kat. 3+, unabhängig von der Schiffs-Kat.", () => {
    expect(darfZweiterLotse("5", "5")).toBe(true);
    expect(darfZweiterLotse("5", "4")).toBe(true);
    expect(darfZweiterLotse("5", "3+")).toBe(true);
    expect(darfZweiterLotse("5", "3")).toBe(false);
    expect(darfZweiterLotse("7", "")).toBe(true);
    expect(darfZweiterLotse("2", "1")).toBe(false);
  });
});

describe("darfJobTyp (Mindest-Kat. je Anmeldungs-Typ)", () => {
  it("1+1, 2+2, WB, WR wie Kat.-4-Schiff", () => {
    for (const typ of ["1+1", "2+2", "WB", "WR"]) {
      expect(darfJobTyp(typ, "4")).toBe(true);
      expect(darfJobTyp(typ, "3+")).toBe(false);
      expect(darfJobTyp(typ, "3")).toBe(false);
      expect(darfJobTyp(typ, "")).toBe(true);
    }
  });

  it("Sonderradar/Nebelradar min. Kat. 3+", () => {
    for (const typ of ["Sonderradar", "Nebelradar"]) {
      expect(darfJobTyp(typ, "3+")).toBe(true);
      expect(darfJobTyp(typ, "4")).toBe(true);
      expect(darfJobTyp(typ, "3")).toBe(false);
    }
  });

  it("AG, EHF, BHF ohne Kategorie-Anforderung", () => {
    expect(darfJobTyp("AG", "1")).toBe(true);
    expect(darfJobTyp("EHF", "1")).toBe(true);
    expect(darfJobTyp("BHF", "1")).toBe(true);
  });
});
