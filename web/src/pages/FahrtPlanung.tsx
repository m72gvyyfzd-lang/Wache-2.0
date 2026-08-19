/**
 * Fahrt-Planung: Vorausplanung der nächsten Fahrt.
 *
 * Oben die Steuerleiste (aktuelle/nächste Fahrt + "Daten ermitteln"),
 * darunter drei Kacheln: "Jobs Brb" (editierbare Zählfelder, per Knopf
 * aus den Listen befüllt — der vorherige Wert bleibt dezent in Klammern
 * sichtbar), "Lotsen aktuell" und "Seestation" (reine Info, live
 * berechnet) sowie "Fahrt" (Bedarf/Anforderung je Richtung).
 *
 * Darunter Phase 2, die Karte "Bört-Vorschau": eine reine Vorschau, welche
 * Lotsen der Einsatzstations-Liste der nächsten Fahrt zugeordnet werden
 * sollen — nichts davon verändert echte Lotsen-Datensätze (siehe
 * lib/boertVorschau.ts für die Ableitungslogik). "Vorschau generieren"
 * schlägt einmalig die ersten `fahrtAnforderung` Kandidaten ab der
 * aktuellen Fahrt-Gruppe vor; danach ist jedes Häkchen rein manuell — kein
 * automatisches Nachrücken oder Verdrängen. Ein unbestätigter Kandidat
 * zwischen dem ersten und letzten bestätigten wird dezent durchgestrichen
 * dargestellt (reine Ableitung aus der aktuellen Bestätigung, nicht an
 * einer festen Anzahl festgemacht). "Einzufügen" ergänzt die Vorschau um
 * neue, noch nicht in der Einsatzstation geführte Lotsen (z.B. aus
 * Urlaub) an einer frei wählbaren Position.
 */
import { useEffect, useMemo, useState } from "react";
import { getAbteilzeitSettings, LOTSEN_KATEGORIEN } from "@wache/core";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import type { AktuelleFahrt, LotsenEintrag } from "../data/types";
import {
  berechneDurchgestrichen,
  boertGrenze,
  boertVorschlag,
  mergeKandidaten,
  vorschauFahrtKlasse,
  type EinzufuegenEintrag,
} from "../lib/boertVorschau";
import {
  endeNaechsterFahrt,
  folgeFahrt,
  PLANBARE_FAHRTEN,
  zaehleJobsBrb,
  zaehleLotsenAktuell,
  zaehleSeestation,
} from "../lib/fahrtplanung";
import { formatUhrzeit } from "../lib/format";
import { formatAbrufzeit, sortiereUndNummeriere } from "../lib/lotsenOrdnung";
import { useData } from "../state/DataContext";
import {
  ladeFahrtRueckgaengig,
  loescheFahrtRueckgaengig,
  speichereFahrtRueckgaengig,
} from "../state/storage";
// Gruppenrahmen der "Fahrt"-Kachel nutzen die Dashboard-Klassen; die
// Bört-Vorschau-Tabelle nutzt Tabellen-/Fahrt-Farb-Klassen der Einsatzstation.
import "../components/ZahlenTile.css";
import "./Einsatzstation.css";
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
  einfuegungen?: EinzufuegenEintrag[];
  bestaetigt?: string[];
  /** Aktivierungskette der Ablauf-Knöpfe: "Daten ermitteln" schaltet
   *  "Vorschau generieren" frei (datenErmittelt), das wiederum
   *  "Fahrt erstellen" (generiert). */
  datenErmittelt?: boolean;
  generiert?: boolean;
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
    setAktuelleFahrt,
    setLotsenListe,
  } = useData();

  const [gespeichert] = useState<Gespeichert>(() => ladeGespeichert());
  const [aktuelle, setAktuelle] = useState<AktuelleFahrt>(gespeichert.aktuelle ?? aktuelleFahrt);
  const [naechste, setNaechste] = useState<AktuelleFahrt>(gespeichert.naechste ?? folgeFahrt(gespeichert.aktuelle ?? aktuelleFahrt));
  const [werte, setWerte] = useState<Werte>({ ...LEERE_WERTE, ...gespeichert.werte });
  const [vorherige, setVorherige] = useState<Partial<Werte>>(gespeichert.vorherige ?? {});

  // --- Bört-Vorschau (Phase 2) — siehe lib/boertVorschau.ts. Reine Vorschau,
  // "bestaetigt" ist der einzige Zustand: ein Häkchen betrifft ausschließlich
  // die eigene Zeile, keine automatische Nachpflege anderer Zeilen.
  const [einfuegungen, setEinfuegungen] = useState<EinzufuegenEintrag[]>(gespeichert.einfuegungen ?? []);
  const [bestaetigt, setBestaetigt] = useState<Set<string>>(new Set(gespeichert.bestaetigt ?? []));
  const [datenErmittelt, setDatenErmittelt] = useState(gespeichert.datenErmittelt ?? false);
  const [generiert, setGeneriert] = useState(gespeichert.generiert ?? false);
  // --- "Fahrt erstellen": Bestätigungsdialog + einstufiges Rückgängig über
  // einen localStorage-Schnappschuss (siehe storage.ts) — er überlebt auch
  // ein Neuladen der Seite.
  const [fahrtDialogOffen, setFahrtDialogOffen] = useState(false);
  const [rueckgaengigDa, setRueckgaengigDa] = useState(() => ladeFahrtRueckgaengig() !== undefined);
  const [neuName, setNeuName] = useState("");
  const [neuKat, setNeuKat] = useState("");
  const [neuBemerkung, setNeuBemerkung] = useState("");
  const [neuNachIndex, setNeuNachIndex] = useState("");

  // Minuten-Tick: das Fahrt-Fenster und die Info-Kacheln hängen an der Uhr.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const daten: Gespeichert = {
      aktuelle,
      naechste,
      werte,
      vorherige,
      einfuegungen,
      bestaetigt: [...bestaetigt],
      datenErmittelt,
      generiert,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(daten));
  }, [aktuelle, naechste, werte, vorherige, einfuegungen, bestaetigt, datenErmittelt, generiert]);

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
    // Schritt 1 der Ablauf-Kette erledigt — schaltet "Vorschau generieren" frei.
    setDatenErmittelt(true);
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

  // --- Bört-Vorschau: Kandidaten = sortierte Lotsenliste (bezogen auf die
  // hier gewählte "aktuelle Fahrt") plus die "Einzufügen"-Platzhalter an
  // ihrer gewählten Position. "bestaetigt" ist reiner, direkt getoggelter
  // Zustand — "durchgestrichen" eine reine Ableitung daraus (siehe
  // lib/boertVorschau.ts): jeder Unbestätigte zwischen dem ersten und
  // letzten Bestätigten, unabhängig von einer festen Anzahl.
  const geordnet = useMemo(() => sortiereUndNummeriere(lotsen, aktuelle), [lotsen, aktuelle]);
  const kandidaten = useMemo(() => mergeKandidaten(geordnet, einfuegungen), [geordnet, einfuegungen]);
  const grenze = useMemo(() => boertGrenze(kandidaten, aktuelle), [kandidaten, aktuelle]);
  const durchgestrichen = useMemo(() => berechneDurchgestrichen(kandidaten, bestaetigt), [kandidaten, bestaetigt]);
  // Positions-Auswahl für "Einzufügen" (Punkt 4.1): nur echte, bestätigte
  // Lotsen ("die vorgeschlagene nächste Fahrt"), Durchgestrichene sind per
  // Definition nicht bestätigt und damit schon ausgenommen.
  const fensterLotsenOptionen = useMemo(() => {
    const optionen: { index: number; name: string }[] = [];
    for (const z of kandidaten) {
      if (z.art === "lotse" && bestaetigt.has(z.id)) optionen.push({ index: z.index, name: z.eintrag.name });
    }
    return optionen;
  }, [kandidaten, bestaetigt]);

  function handleVorschauGenerieren() {
    setBestaetigt(boertVorschlag(kandidaten, grenze, fahrtAnforderung));
    setGeneriert(true);
  }

  /** Ein Häkchen betrifft ausschließlich die eigene Zeile — keine
   *  automatische Auffüll- oder Verdrängungslogik. */
  function toggleHaekchen(id: string) {
    setBestaetigt((s) => {
      const neu = new Set(s);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  // --- "Fahrt erstellen": Zähler für den Bestätigungsdialog.
  const anzahlGestrichen = useMemo(
    () => kandidaten.filter((z) => z.art === "lotse" && durchgestrichen.has(z.id)).length,
    [kandidaten, durchgestrichen],
  );
  const anzahlNeu = useMemo(
    () => einfuegungen.filter((e) => bestaetigt.has(`n${e.id}`)).length,
    [einfuegungen, bestaetigt],
  );

  /**
   * Überträgt die Vorschau in die echte Einsatzstations-Liste:
   * - jeder Kandidat mit Häkchen bekommt fahrt = nächste Fahrt,
   * - ALLE Lotsen der bisherigen aktuellen Fahrt wechseln ebenfalls in die
   *   nächste Fahrt (auch abgeteilte) — die alte und die neue Besatzung
   *   bilden zusammen die neue Fahrt,
   * - Durchgestrichene werden komplett aus der Liste gelöscht,
   * - bestätigte "Aus Verhinderung"-Einträge werden als neue Lotsen an
   *   ihrer gewählten Position angelegt (Törn-Zähler 0, per Quick-Edit
   *   pflegbar),
   * - alle übrigen bleiben unverändert,
   * - die aktuelle Fahrt (global + Seite) springt auf die nächste Fahrt,
   * - danach wird die Planung geleert (Zählfelder, Häkchen, Verhinderungs-
   *   Einträge, Ablauf-Kette) — der Rückgängig-Schnappschuss sichert den
   *   kompletten Stand von davor, Aufräumen und Rückgängig vertragen sich
   *   also.
   */
  function handleFahrtErstellen() {
    const vorher: Gespeichert = {
      aktuelle,
      naechste,
      werte,
      vorherige,
      einfuegungen,
      bestaetigt: [...bestaetigt],
      datenErmittelt,
      generiert,
    };
    speichereFahrtRueckgaengig({ lotsen, aktuelleFahrt, fahrtPlanung: vorher });

    const geloescht = new Set<number>();
    const uebernommen = new Set<number>();
    for (const z of kandidaten) {
      if (z.art !== "lotse") continue;
      if (bestaetigt.has(z.id)) uebernommen.add(z.index);
      else if (durchgestrichen.has(z.id)) geloescht.add(z.index);
    }
    const neu: { origIndex?: number; eintrag: LotsenEintrag }[] = [];
    lotsen.forEach((l, i) => {
      if (geloescht.has(i)) return;
      const wechselt = uebernommen.has(i) || l.fahrt === aktuelle;
      neu.push({ origIndex: i, eintrag: wechselt ? { ...l, fahrt: naechste } : l });
    });
    for (const e of einfuegungen) {
      if (!bestaetigt.has(`n${e.id}`)) continue;
      const neuerLotse: LotsenEintrag = {
        name: e.name,
        kategorie: e.kategorie,
        fahrt: naechste,
        elbehafen: false,
        toern2Plus2: 0,
        toernWb: 0,
        toernWr: 0,
        toernHulo: 0,
        bemerkung: e.bemerkung,
      };
      const pos = e.nachIndex === undefined ? -1 : neu.findIndex((n) => n.origIndex === e.nachIndex);
      if (pos === -1) neu.push({ eintrag: neuerLotse });
      else neu.splice(pos + 1, 0, { eintrag: neuerLotse });
    }

    setLotsenListe(neu.map((n) => n.eintrag));
    setAktuelleFahrt(naechste);
    setAktuelle(naechste);
    setNaechste(folgeFahrt(naechste));
    // Planung aufräumen: alles zurück auf leer für die nächste Runde.
    setWerte({ ...LEERE_WERTE });
    setVorherige({});
    setEinfuegungen([]);
    setBestaetigt(new Set());
    setDatenErmittelt(false);
    setGeneriert(false);
    setRueckgaengigDa(true);
    setFahrtDialogOffen(false);
  }

  /** Stellt den Stand von unmittelbar vor dem letzten "Fahrt erstellen"
   *  wieder her — Lotsen-Liste, aktuelle Fahrt und den Zustand dieser
   *  Seite. Einstufig: danach ist der Schnappschuss verbraucht. */
  function handleRueckgaengig() {
    const snap = ladeFahrtRueckgaengig();
    if (!snap) {
      setRueckgaengigDa(false);
      return;
    }
    setLotsenListe(snap.lotsen);
    setAktuelleFahrt(snap.aktuelleFahrt);
    const fp = snap.fahrtPlanung as Gespeichert | undefined;
    if (fp) {
      if (fp.aktuelle) setAktuelle(fp.aktuelle);
      if (fp.naechste) setNaechste(fp.naechste);
      setWerte({ ...LEERE_WERTE, ...fp.werte });
      setVorherige(fp.vorherige ?? {});
      setEinfuegungen(fp.einfuegungen ?? []);
      setBestaetigt(new Set(fp.bestaetigt ?? []));
      setDatenErmittelt(fp.datenErmittelt ?? false);
      setGeneriert(fp.generiert ?? false);
    }
    loescheFahrtRueckgaengig();
    setRueckgaengigDa(false);
  }

  function handleEinfuegenHinzufuegen() {
    const name = neuName.trim();
    if (!name) return;
    const eintrag: EinzufuegenEintrag = {
      id: crypto.randomUUID(),
      name,
      kategorie: neuKat,
      bemerkung: neuBemerkung.trim(),
      nachIndex: neuNachIndex === "" ? undefined : Number(neuNachIndex),
    };
    setEinfuegungen((liste) => [...liste, eintrag]);
    setNeuName("");
    setNeuBemerkung("");
  }

  function handleEinfuegenEntfernen(id: string) {
    setEinfuegungen((liste) => liste.filter((e) => e.id !== id));
    const kid = `n${id}`;
    setBestaetigt((s) => (s.has(kid) ? new Set([...s].filter((x) => x !== kid)) : s));
  }

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

      <div className="boert-reihe">
        <section className="fahrt-kachel boert-vorschau">
          <div className="boert-kopf">
            <h3 className="boert-kopf__titel">Bört-Vorschau</h3>
            <span className={`boert-bilanz ${bestaetigt.size === fahrtAnforderung ? "boert-bilanz--ok" : "boert-bilanz--fehlt"}`}>
              bestätigt {bestaetigt.size} / {fahrtAnforderung}
            </span>
          </div>

          <div className="tabelle-scroll boert-tabelle-scroll">
            <table className="lotsen-table">
              <thead>
                <tr>
                  <th className="num">Fahrt #</th>
                  <th>Name</th>
                  <th className="num">Kat.</th>
                  <th className="num">Abr.</th>
                  <th className="num">BB</th>
                  <th>Bemerkungen</th>
                  <th className="num">Confirm</th>
                </tr>
              </thead>
              <tbody>
                {kandidaten.map((zeile) => {
                  const istEingefuegt = zeile.art === "einfuegung";
                  const eintrag = zeile.eintrag;
                  const istDurchgestrichen = durchgestrichen.has(zeile.id);
                  const fahrtKlasse = vorschauFahrtKlasse(zeile, bestaetigt, istDurchgestrichen, naechste);
                  return (
                    <tr key={zeile.id} className={`${fahrtKlasse} ${istDurchgestrichen ? "boert-zeile--abgelehnt" : ""}`}>
                      <td className="num muted">{zeile.art === "lotse" ? zeile.fahrtNr ?? "·" : "–"}</td>
                      <td className="cell-name">
                        {eintrag.name}
                        {istEingefuegt && (
                          <>
                            <span className="boert-neu-badge">neu</span>
                            <button
                              type="button"
                              className="btn btn--icon boert-entfernen"
                              title="Einzufügen-Eintrag entfernen"
                              onClick={() => handleEinfuegenEntfernen((zeile.eintrag as EinzufuegenEintrag).id)}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </td>
                      <td className="num">{eintrag.kategorie === "" ? "–" : eintrag.kategorie}</td>
                      <td className="num muted">{zeile.art === "lotse" ? formatAbrufzeit(zeile.eintrag.abrufStunden) || "·" : "–"}</td>
                      <td className="num muted">{zeile.art === "lotse" ? zeile.bb ?? "·" : "–"}</td>
                      <td className="muted">{eintrag.bemerkung}</td>
                      <td className="num">
                        <input type="checkbox" checked={bestaetigt.has(zeile.id)} onChange={() => toggleHaekchen(zeile.id)} />
                      </td>
                    </tr>
                  );
                })}
                {kandidaten.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 20 }} className="muted">
                      keine Lotsen
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rechte Spalte (1/4 Breite): oben die Ablauf-Kachel mit allen vier
            Knöpfen — sie schalten sich der Reihe nach frei: Daten ermitteln
            → Vorschau generieren → Fahrt erstellen → Rückgängig. Darunter
            "Aus Verhinderung". */}
        <div className="boert-rechts">
          <section className="fahrt-kachel boert-erstellen">
            <button type="button" className="btn btn--accent" onClick={handleErmitteln}>
              Daten ermitteln
            </button>
            <button type="button" className="btn btn--accent" disabled={!datenErmittelt} onClick={handleVorschauGenerieren}>
              Vorschau generieren
            </button>
            <button type="button" className="btn btn--accent" disabled={!generiert} onClick={() => setFahrtDialogOffen(true)}>
              Fahrt erstellen
            </button>
            <button
              type="button"
              className="btn"
              disabled={!rueckgaengigDa}
              onClick={handleRueckgaengig}
              title="Letztes 'Fahrt erstellen' rückgängig machen"
            >
              Rückgängig
            </button>
          </section>

          <section className="fahrt-kachel boert-einfuegen">
            <h3 className="fahrt-kachel__titel">Aus Verhinderung</h3>
          <div className="boert-einfuegen__formular">
            <input
              type="text"
              placeholder="Name"
              value={neuName}
              onChange={(e) => setNeuName(e.target.value)}
            />
            <select value={neuKat} onChange={(e) => setNeuKat(e.target.value)}>
              {LOTSEN_KATEGORIEN.map((kat) => (
                <option key={kat} value={kat}>
                  {kat === "" ? "Volllotse" : kat}
                </option>
              ))}
            </select>
            <select value={neuNachIndex} onChange={(e) => setNeuNachIndex(e.target.value)}>
              <option value="">am Ende</option>
              {fensterLotsenOptionen.map(({ index, name }) => (
                <option key={index} value={index}>
                  nach {name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Bemerkung (z.B. aus Urlaub)"
              value={neuBemerkung}
              onChange={(e) => setNeuBemerkung(e.target.value)}
            />
            <button type="button" className="btn btn--accent" onClick={handleEinfuegenHinzufuegen} disabled={!neuName.trim()}>
              Hinzufügen
            </button>
          </div>

            {einfuegungen.length > 0 && (
              <ul className="boert-einfuegen__liste">
                {einfuegungen.map((e) => (
                  <li key={e.id}>
                    <span className="boert-einfuegen__eintrag-name">{e.name}</span>
                    <span className="muted">
                      {e.kategorie === "" ? "Volllotse" : e.kategorie} ·{" "}
                      {e.nachIndex === undefined ? "am Ende" : `nach ${lotsen[e.nachIndex]?.name ?? "?"}`}
                      {e.bemerkung ? ` · ${e.bemerkung}` : ""}
                    </span>
                    <button type="button" className="btn btn--small btn--danger" onClick={() => handleEinfuegenEntfernen(e.id)}>
                      Entfernen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {fahrtDialogOffen && (
        <Modal title="Fahrt erstellen" onClose={() => setFahrtDialogOffen(false)} maxWidth="420px" titelZentriert>
          <div className="fahrt-dialog">
            <ul className="fahrt-dialog__punkte">
              <li>
                {bestaetigt.size} {bestaetigt.size === 1 ? "Lotse" : "Lotsen"} in die {naechste}-Fahrt nehmen
              </li>
              <li>
                {anzahlGestrichen} {anzahlGestrichen === 1 ? "Lotse fällt" : "Lotsen fallen"} raus
              </li>
              <li>
                {anzahlNeu} {anzahlNeu === 1 ? "Lotse kommt" : "Lotsen kommen"} aus Verhinderung dazu
              </li>
            </ul>
            <div className="fahrt-dialog__knoepfe">
              <button type="button" className="btn" onClick={() => setFahrtDialogOffen(false)}>
                Abbrechen
              </button>
              <button type="button" className="btn btn--accent" onClick={handleFahrtErstellen}>
                Fahrt erstellen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
