/**
 * Fahrt-Planung (Phase 1): Vorausplanung der nächsten Fahrt.
 *
 * Oben die Steuerleiste (aktuelle/nächste Fahrt + "Daten ermitteln"),
 * darunter drei Kacheln: "Jobs Brb" (editierbare Zählfelder, per Knopf
 * aus den Listen befüllt — der vorherige Wert bleibt dezent in Klammern
 * sichtbar), "Lotsen aktuell" und "Seestation" (reine Info, live
 * berechnet). Die Zuordnung der Lotsen zur nächsten Fahrt folgt in
 * Phase 2.
 */
import { useEffect, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { PageHeader } from "../components/PageHeader";
import type { AktuelleFahrt } from "../data/types";
import {
  endeNaechsterFahrt,
  folgeFahrt,
  PLANBARE_FAHRTEN,
  zaehleJobsBrb,
  zaehleLotsenAktuell,
  zaehleSeestation,
} from "../lib/fahrtplanung";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";
// Gruppenrahmen der "Fahrt"-Kachel nutzen die Dashboard-Klassen.
import "../components/ZahlenTile.css";
import "./FahrtPlanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

const STORAGE_KEY = "wache.fahrtplanung.v1";

interface FeldDef {
  key: FeldKey;
  label: string;
  /** wird von "Daten ermitteln" aus den Listen befüllt — die übrigen
   *  Felder (lose Abgänge, im Zulauf, Reserve) sind reine Handeingaben. */
  ermittelt: boolean;
}

/** Linker Block: zwei dezent umrahmte Paare (Hamburg-Seite / NOK-Seite). */
const LINKE_RAHMEN: FeldDef[][] = [
  [
    { key: "hamburg", label: "aus HH", ermittelt: true },
    { key: "loseAbgaenge", label: "lose Abgänge", ermittelt: false },
  ],
  [
    { key: "nok", label: "im NOK", ermittelt: true },
    { key: "imZulauf", label: "im Zulauf", ermittelt: false },
  ],
];

/** Rechter Block: Liegende oben, dann Radar/Vergaben/AG/Reserve. */
const RECHTE_FELDER: FeldDef[] = [
  { key: "liegend", label: "Liegende Schiffe", ermittelt: true },
  { key: "radar", label: "Radar", ermittelt: true },
  { key: "vergaben", label: "Listenvergaben", ermittelt: true },
  { key: "ag", label: "AG", ermittelt: true },
  { key: "reserve", label: "Reserve", ermittelt: false },
];

type FeldKey = "hamburg" | "loseAbgaenge" | "nok" | "imZulauf" | "liegend" | "radar" | "vergaben" | "ag" | "reserve";
type Werte = Record<FeldKey, string>;

const LEERE_WERTE: Werte = {
  hamburg: "",
  loseAbgaenge: "",
  nok: "",
  imZulauf: "",
  liegend: "",
  radar: "",
  vergaben: "",
  ag: "",
  reserve: "",
};

interface Gespeichert {
  aktuelle?: AktuelleFahrt;
  naechste?: AktuelleFahrt;
  werte?: Partial<Werte>;
  vorherige?: Partial<Werte>;
}

function ladeGespeichert(): Gespeichert {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Gespeichert;
  } catch {
    return {};
  }
}

export function FahrtPlanung() {
  const {
    jobs,
    lotsen,
    abteilungen,
    seeSchiffe,
    seeAbteilungen,
    seestationLotsen,
    aktuelleFahrt,
  } = useData();

  const [gespeichert] = useState<Gespeichert>(() => ladeGespeichert());
  const [aktuelle, setAktuelle] = useState<AktuelleFahrt>(gespeichert.aktuelle ?? aktuelleFahrt);
  const [naechste, setNaechste] = useState<AktuelleFahrt>(gespeichert.naechste ?? folgeFahrt(gespeichert.aktuelle ?? aktuelleFahrt));
  const [werte, setWerte] = useState<Werte>({ ...LEERE_WERTE, ...gespeichert.werte });
  const [vorherige, setVorherige] = useState<Partial<Werte>>(gespeichert.vorherige ?? {});

  // Minuten-Tick: das Fahrt-Fenster und die Info-Kacheln hängen an der Uhr.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aktuelle, naechste, werte, vorherige }));
  }, [aktuelle, naechste, werte, vorherige]);

  function handleAktuelle(fahrt: AktuelleFahrt) {
    setAktuelle(fahrt);
    // Die nächste Fahrt folgt dem Schema automatisch — der User kann sie
    // danach bewusst abweichend setzen (mit Hinweis).
    setNaechste(folgeFahrt(fahrt));
  }

  const schemaBruch = naechste !== folgeFahrt(aktuelle);
  const endeNaechste = endeNaechsterFahrt(naechste, jetzt);

  function handleErmitteln() {
    const zaehlung = zaehleJobsBrb(jobs, abteilungen, settings, endeNaechste);
    const neu: Partial<Werte> = {
      hamburg: String(zaehlung.hamburg),
      nok: String(zaehlung.nok),
      liegend: String(zaehlung.liegend),
      radar: String(zaehlung.radar),
      vergaben: String(zaehlung.vergaben),
      ag: String(zaehlung.ag),
    };
    // Vorwerte nur für die neu eingelesenen Felder merken — und nur, wenn
    // dort schon etwas stand (beim allerersten Ermitteln gibt es nichts
    // zu vergleichen).
    const alteVorwerte: Partial<Werte> = {};
    for (const key of Object.keys(neu) as FeldKey[]) {
      if (werte[key] !== "") alteVorwerte[key] = werte[key];
    }
    setVorherige(alteVorwerte);
    setWerte((w) => ({ ...w, ...neu }));
  }

  const lotsenAktuell = zaehleLotsenAktuell(lotsen, abteilungen, seestationLotsen, aktuelle);
  const seestation = zaehleSeestation(seeSchiffe, seeAbteilungen, endeNaechste);

  // "Fahrt"-Kachel: je Richtung Bedarf und Anforderung.
  //
  // ausgehend — Bedarf ist die Summe aller Zählfelder der Jobs-Brb-Kachel
  // (leere Felder zählen als 0; das AG-Feld enthält bereits Lotsen, nicht
  // Jobs). Die Anforderung zieht davon die Lotsen ab, die noch in der
  // laufenden Fahrt sind: sie deckt nur, was darüber hinaus gebraucht
  // wird — reichen sie aus, ist nichts anzufordern (0 statt negativ).
  const zahl = (key: FeldKey) => Number(werte[key]) || 0;
  const bedarfAusgehend = (Object.keys(LEERE_WERTE) as FeldKey[]).reduce((summe, key) => summe + zahl(key), 0);
  const anforderungAusgehend = Math.max(0, bedarfAusgehend - lotsenAktuell.inFahrt);

  // einkommend — Bedarf sind die bis zum Planungsende benötigten Lotsen
  // (dieselbe Zahl wie in der Seestations-Kachel). Die Anforderung zieht
  // davon ab, was bis dahin ohnehin zur Verfügung steht: alle Lotsen der
  // Kachel "Lotsen aktuell" (in der Fahrt, im Fahrwasser, auf Seestation)
  // plus die für ausgehend bereits angeforderten Lotsen — die kommen mit
  // ihrem Job zur Seestation und stehen dort anschließend bereit. Deckt
  // das den Bedarf, ist nichts anzufordern (0 statt negativ).
  //
  // Nicht jeder ausgehend angeforderte Lotse landet aber auf der
  // Seestation: Listenvergaben und Radar-Jobs enden im Revier. Für die
  // einkommende Rechnung zählt deshalb nur die Anforderung ohne diese
  // beiden Felder.
  const seestationsWirksamerBedarf = bedarfAusgehend - zahl("vergaben") - zahl("radar");
  const anforderungAusgehendSeestation = Math.max(0, seestationsWirksamerBedarf - lotsenAktuell.inFahrt);
  const vorhandenEinkommend =
    lotsenAktuell.inFahrt + lotsenAktuell.fahrwasser + lotsenAktuell.aufSeestation + anforderungAusgehendSeestation;
  const anforderungEinkommend = Math.max(0, seestation.lotsenBedarf - vorhandenEinkommend);

  // Was insgesamt für die nächste Fahrt anzufordern ist: beide Richtungen
  // zusammen.
  const fahrtAnforderung = anforderungAusgehend + anforderungEinkommend;

  function feldZeile(feld: FeldDef) {
    return (
      <label key={feld.key} className="fahrt-feld">
        <span className="fahrt-feld__label">{feld.label}</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={werte[feld.key]}
          onChange={(e) => setWerte((w) => ({ ...w, [feld.key]: e.target.value }))}
        />
        <span className="fahrt-feld__vorwert">
          {feld.ermittelt && vorherige[feld.key] !== undefined ? `(${vorherige[feld.key]})` : ""}
        </span>
      </label>
    );
  }

  return (
    <div>
      <PageHeader title="Fahrt-Planung" centered />

      <div className="fahrt-kachel fahrt-steuer">
        <label className="fahrt-steuer__feld">
          aktuelle Fahrt
          <select value={aktuelle} onChange={(e) => handleAktuelle(e.target.value as AktuelleFahrt)}>
            {PLANBARE_FAHRTEN.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="fahrt-steuer__feld">
          nächste Fahrt
          <select value={naechste} onChange={(e) => setNaechste(e.target.value as AktuelleFahrt)}>
            {PLANBARE_FAHRTEN.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        {schemaBruch && (
          <span className="fahrt-steuer__hinweis">
            ⚠ passt nicht zum Schema — nach {aktuelle} folgt üblicherweise {folgeFahrt(aktuelle)}
          </span>
        )}
        <span className="fahrt-steuer__spacer" />
        <span className="fahrt-steuer__fenster">Fenster bis {formatUhrzeit(endeNaechste)}</span>
        <button type="button" className="btn btn--accent" onClick={handleErmitteln}>
          Daten ermitteln
        </button>
      </div>

      <div className="fahrt-reihe">
        <section className="fahrt-kachel fahrt-jobs">
          <h3 className="fahrt-kachel__titel">Jobs Brb</h3>
          <div className="fahrt-jobs__gruppen">
            <div className="fahrt-jobs__links">
              {LINKE_RAHMEN.map((rahmen, ri) => (
                <div key={ri} className="fahrt-jobs__rahmen">
                  {rahmen.map((feld) => feldZeile(feld))}
                </div>
              ))}
            </div>
            <div className="fahrt-jobs__gruppe">{RECHTE_FELDER.map((feld) => feldZeile(feld))}</div>
          </div>
        </section>

        <div className="fahrt-rechts">
          <div className="fahrt-info-reihe">
            <section className="fahrt-kachel fahrt-info">
              <h3 className="fahrt-kachel__titel">Lotsen aktuell</h3>
              <div className="fahrt-info__zeilen">
                <div className="fahrt-feld">
                  <span className="fahrt-feld__label">in der Fahrt</span>
                  <output>{lotsenAktuell.inFahrt}</output>
                </div>
                <div className="fahrt-feld">
                  <span className="fahrt-feld__label">im Fahrwasser</span>
                  <output>{lotsenAktuell.fahrwasser}</output>
                </div>
                <div className="fahrt-feld">
                  <span className="fahrt-feld__label">Auf Seestation</span>
                  <output>{lotsenAktuell.aufSeestation}</output>
                </div>
              </div>
            </section>

            <section className="fahrt-kachel fahrt-info">
              <h3 className="fahrt-kachel__titel">Seestation</h3>
              <div className="fahrt-info__zeilen">
                <div className="fahrt-feld">
                  <span className="fahrt-feld__label">aktuelle ETAs</span>
                  <output>
                    {seestation.etasBis}
                    <span className="fahrt-info__gesamt"> / {seestation.etasGesamt}</span>
                  </output>
                </div>
                <div className="fahrt-feld">
                  <span className="fahrt-feld__label">benötigte Lotsen</span>
                  <output>
                    {seestation.lotsenBedarf}
                    <span className="fahrt-info__gesamt"> / {seestation.lotsenBedarfGesamt}</span>
                  </output>
                </div>
              </div>
            </section>
          </div>

          {/* Zusammenfassung beider Richtungen — Gruppenrahmen im Stil der
              Dashboard-Kacheln (siehe components/ZahlenTile.css). Wächst
              mit (siehe CSS), damit die rechte Spalte insgesamt so hoch
              wird wie "Jobs Brb" links. */}
          <section className="fahrt-kachel fahrt-bilanz" data-testid="kachel-fahrt">
            <h3 className="fahrt-kachel__titel">Fahrt</h3>
            <div className="fahrt-bilanz__inhalt">
              <div className="fahrt-bilanz__gruppen">
                <fieldset className="zahlen-tile__gruppe" data-testid="fahrt-ausgehend">
                  <legend className="zahlen-tile__titel">ausgehend</legend>
                  <div className="zahlen-tile__werte">
                    <div className="zahlen-tile__spalte">
                      <span className="zahlen-tile__kuerzel">Bedarf</span>
                      <span className="zahlen-tile__zahl">{bedarfAusgehend}</span>
                    </div>
                    <div className="zahlen-tile__spalte">
                      <span className="zahlen-tile__kuerzel">Anforderung</span>
                      <span className="zahlen-tile__zahl">{anforderungAusgehend}</span>
                    </div>
                  </div>
                </fieldset>
                <fieldset className="zahlen-tile__gruppe" data-testid="fahrt-einkommend">
                  <legend className="zahlen-tile__titel">einkommend</legend>
                  <div className="zahlen-tile__werte">
                    <div className="zahlen-tile__spalte">
                      <span className="zahlen-tile__kuerzel">Bedarf</span>
                      <span className="zahlen-tile__zahl">{seestation.lotsenBedarf}</span>
                    </div>
                    <div className="zahlen-tile__spalte">
                      <span className="zahlen-tile__kuerzel">Anforderung</span>
                      <span className="zahlen-tile__zahl">{anforderungEinkommend}</span>
                    </div>
                  </div>
                </fieldset>
              </div>
              {/* Gesamtanforderung beider Richtungen — ein Rahmen im selben
                  Stil, so hoch wie die beiden links zusammen. Beide Spalten
                  füllen die Zeilenhöhe aus (siehe CSS), damit sie unabhängig
                  von Gerät und Schriftgröße bündig abschließen. */}
              <div className="fahrt-bilanz__gesamt-zelle">
                <fieldset className="zahlen-tile__gruppe fahrt-bilanz__gesamt" data-testid="fahrt-anforderung">
                  <legend className="zahlen-tile__titel">Fahrtanforderung</legend>
                  <span className="fahrt-bilanz__gesamt-zahl">{fahrtAnforderung}</span>
                </fieldset>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
