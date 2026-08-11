import { describe, expect, it } from "vitest";
import {
  ABTEILUNG_VOR_ANKUNFT_MIN,
  berechneBrbPrognose,
  berechneSeePrognose,
  minutenVorNaechstemHw,
  SEE_ABFAHRT_OFFSET_MIN,
  type HwBrb,
} from "../src/brbMatrix";
import { BRB_MATRIX } from "../src/brbMatrixDaten";
import { berechneAbteilzeit } from "../src/abteilzeit";
import { getAbteilzeitSettings } from "../src/settings";
import type { Job } from "../src/types";

const um = (hhmm: string, tag = 15): Date => new Date(`2026-08-${String(tag).padStart(2, "0")}T${hhmm}:00`);

const hwBrb: HwBrb = { hw1: um("12:00"), hw2: um("00:25", 16) }; // Periode 745 min

const hhJob = (extra: Partial<Job>): Job => ({ jobNr: 1, routentyp: "HH", ...extra });

describe("minutenVorNaechstemHw", () => {
  it("liefert den direkten Abstand, wenn die Zeit vor HW_1 liegt", () => {
    expect(minutenVorNaechstemHw(hwBrb, um("11:30"))).toBe(30);
    expect(minutenVorNaechstemHw(hwBrb, um("12:00"))).toBe(0);
  });

  it("nutzt HW_2, wenn die Zeit zwischen den beiden HW liegt", () => {
    // 14:00 → nächstes HW ist HW_2 um 00:25 = 625 min später
    expect(minutenVorNaechstemHw(hwBrb, um("14:00"))).toBe(625);
  });

  it("schreibt periodisch fort, wenn die Zeit nach HW_2 liegt", () => {
    // 01:25 am 16. = 60 min nach HW_2 → nächstes HW in 745 − 60 = 685 min
    expect(minutenVorNaechstemHw(hwBrb, um("01:25", 16))).toBe(685);
  });

  it("fällt ohne HW_2 auf die mittlere Tidenperiode zurück", () => {
    expect(minutenVorNaechstemHw({ hw1: um("12:00") }, um("11:30"))).toBe(30);
    // 13:00 = 60 min nach HW_1 → 745 − 60 = 685
    expect(minutenVorNaechstemHw({ hw1: um("12:00") }, um("13:00"))).toBe(685);
  });
});

describe("berechneBrbPrognose", () => {
  it("liest exakte Stützstellen direkt aus der Matrix (FkW / HaLo-Tabelle)", () => {
    // FkW-Abgang 11:30 = 30 min vor HW → Matrixzeile 30, Klasse "normal"
    const p = berechneBrbPrognose(hhJob({ fkwTickerAbgang: um("11:30") }), hwBrb)!;
    expect(p.basis).toBe("fkw");
    expect(p.offsetVorHwMin).toBe(30);
    expect(p.fahrzeitMin).toBe(BRB_MATRIX.halo[30].normal);
    expect(p.ankunftBrb.getTime()).toBe(um("11:30").getTime() + p.fahrzeitMin * 60_000);
  });

  it("interpoliert linear zwischen zwei Stützstellen", () => {
    // 37,5 min vor HW → Mittelwert der Zeilen 30 und 45
    const p = berechneBrbPrognose(hhJob({ fkwTickerAbgang: new Date(um("11:22").getTime() - 30_000) }), hwBrb)!;
    const erwartet = (BRB_MATRIX.halo[30].normal + BRB_MATRIX.halo[45].normal) / 2;
    expect(p.fahrzeitMin).toBe(Math.round(erwartet));
  });

  it("nimmt die Stade-Meldung (DOW-Tabelle) vor der FkW-Meldung", () => {
    const p = berechneBrbPrognose(
      hhJob({ fkwTickerAbgang: um("09:00"), stadeKuden: um("11:30"), geschwindigkeitsklasse: "schnell" }),
      hwBrb
    )!;
    expect(p.basis).toBe("stade");
    expect(p.fahrzeitMin).toBe(BRB_MATRIX.stade[30].schnell);
  });

  it("unterscheidet die Geschwindigkeitsklassen", () => {
    const langsam = berechneBrbPrognose(hhJob({ fkwTickerAbgang: um("11:30"), geschwindigkeitsklasse: "langsam" }), hwBrb)!;
    const schnell = berechneBrbPrognose(hhJob({ fkwTickerAbgang: um("11:30"), geschwindigkeitsklasse: "schnell" }), hwBrb)!;
    expect(langsam.fahrzeitMin).toBeGreaterThan(schnell.fahrzeitMin);
  });

  it("setzt die Abteilzeit 20 min vor die Ankunft", () => {
    const p = berechneBrbPrognose(hhJob({ fkwTickerAbgang: um("11:30") }), hwBrb)!;
    expect(p.ankunftBrb.getTime() - p.abteilzeit.getTime()).toBe(ABTEILUNG_VOR_ANKUNFT_MIN * 60_000);
  });

  it("liefert undefined für Nicht-HH-Jobs und ohne Meldepunkt", () => {
    expect(berechneBrbPrognose({ jobNr: 1, routentyp: "NOK", fkwTickerAbgang: um("11:30") }, hwBrb)).toBeUndefined();
    expect(berechneBrbPrognose(hhJob({ hhHoltenau: um("10:00") }), hwBrb)).toBeUndefined();
  });
});

describe("berechneSeePrognose", () => {
  it("addiert den Herkunfts-Offset bis zur Abfahrt Tn_59", () => {
    for (const herkunft of ["HH", "NOK", "VNR"] as const) {
      const p = berechneSeePrognose(um("11:00"), herkunft, "normal", hwBrb);
      expect(p.abfahrtTn59.getTime()).toBe(
        um("11:00").getTime() + SEE_ABFAHRT_OFFSET_MIN[herkunft] * 60_000
      );
    }
  });

  it("liest exakte Stützstellen aus der See-Tabelle (Offset zur Abfahrt Tn_59)", () => {
    // Abteilung 11:15 + 15 min (HH) = Abfahrt 11:30 = 30 min vor HW
    const p = berechneSeePrognose(um("11:15"), "HH", "normal", hwBrb);
    expect(p.offsetVorHwMin).toBe(30);
    expect(p.fahrzeitMin).toBe(BRB_MATRIX.see[30].normal);
    expect(p.ankunftSee.getTime()).toBe(p.abfahrtTn59.getTime() + p.fahrzeitMin * 60_000);
  });

  it("unterscheidet die Geschwindigkeitsklassen und defaultet auf normal", () => {
    const langsam = berechneSeePrognose(um("11:15"), "HH", "langsam", hwBrb);
    const schnell = berechneSeePrognose(um("11:15"), "HH", "schnell", hwBrb);
    const standard = berechneSeePrognose(um("11:15"), "HH", undefined, hwBrb);
    expect(langsam.fahrzeitMin).toBeGreaterThan(schnell.fahrzeitMin);
    expect(standard.fahrzeitMin).toBe(BRB_MATRIX.see[30].normal);
  });
});

describe("berechneAbteilzeit mit HW-Brb-Matrix", () => {
  const settings = getAbteilzeitSettings("Flut");

  it("nutzt die Matrix für HH-Jobs, wenn hwBrb gegeben ist", () => {
    const job = hhJob({ fkwTickerAbgang: um("11:30") });
    const prognose = berechneBrbPrognose(job, hwBrb)!;
    expect(berechneAbteilzeit(job, settings, hwBrb)?.getTime()).toBe(prognose.abteilzeit.getTime());
  });

  it("fällt ohne hwBrb auf die festen Offsets zurück", () => {
    const job = hhJob({ fkwTickerAbgang: um("11:30") });
    // Flut: FkW + 3:00
    expect(berechneAbteilzeit(job, settings)?.getTime()).toBe(um("14:30").getTime());
  });

  it("fällt mit hwBrb, aber nur HH-Meldung (Holtenau) auf den festen Offset zurück", () => {
    const job = hhJob({ hhHoltenau: um("10:00") });
    // Flut: HH + 3:29
    expect(berechneAbteilzeit(job, settings, hwBrb)?.getTime()).toBe(um("13:29").getTime());
  });

  it("manueller Override sticht auch die Matrix aus", () => {
    const job = hhJob({ fkwTickerAbgang: um("11:30"), abteilungManuell: um("15:00") });
    expect(berechneAbteilzeit(job, settings, hwBrb)?.getTime()).toBe(um("15:00").getTime());
  });

  it("NOK-Jobs bleiben von der Matrix unberührt", () => {
    const job: Job = { jobNr: 1, routentyp: "NOK", stadeKuden: um("11:30") };
    expect(berechneAbteilzeit(job, settings, hwBrb)?.getTime()).toBe(um("12:30").getTime());
  });
});
