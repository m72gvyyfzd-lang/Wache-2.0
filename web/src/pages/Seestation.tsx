import { Fragment, useEffect, useRef, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { FrageModal } from "../components/FrageModal";
import { SchiffKatSelect } from "../components/formShared";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { QuickEditPopover } from "../components/QuickEditPopover";
import {
  SeeSchiffEditModal,
  SeeSchiffNeuModal,
  SeestationLotseAktionModal,
  SeestationLotseNeuModal,
} from "../components/SeestationModals";
import type { SeeSchiff } from "../data/types";
import { formatUhrzeit } from "../lib/format";
import {
  ANMELDUNG_ESKALATION_MS,
  ANMELDUNG_VORWARNUNG_MS,
  planungsEta,
  sortiereSeestation,
  vergleicheVorschauAbt,
  VORLAUF_AUF_STATION_MS,
  VORLAUF_WARNUNG_MS,
  vorschauAbtZeiten,
  zeilenAusAbteilungen,
  zeilenAusSeestationLotsen,
  type SeestationZeile,
} from "../lib/seestation";
import {
  eignungsWarnungSeestation,
  planeSeestation,
  schiffePriorisiert,
  seeLotsenAnzahl,
  type SeestationSlot,
  type SeestationZuteilung,
} from "../lib/seestationAbteilen";
import { vorschauZeilen } from "../lib/vorschau";
import { useData } from "../state/DataContext";
import "./Seestation.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** Farb-/Stil-Klasse eines einzelnen Namens im Zuteilungs-Hinweis:
 *  - verplanter Lotse (Vorschau, kommt mit seinem Job-Schiff raus): orange,
 *    bei Verspätung orange+fett
 *  - freier Lotse (Vorschau, noch ohne Job, per AG holbar): blau, bei
 *    Verspätung blau+fett
 *  - echter Lotse (auf Station oder unterwegs), verspätet: rot
 *  - echter Lotse, pünktlich: schwarz+fett wenn das Schiff angemeldet ist
 *    (verlässliche Aussage), sonst dezent grau */
function zuteilungNameKlasse(slot: SeestationSlot, angemeldet: boolean): string {
  if (slot.zeile.projiziert === "verplant") return slot.verspaetet ? "zuteilung-name--verplant-warn" : "zuteilung-name--verplant";
  if (slot.zeile.projiziert === "frei") return slot.verspaetet ? "zuteilung-name--frei-warn" : "zuteilung-name--frei";
  if (slot.verspaetet) return "zuteilung-name--rot";
  return angemeldet ? "zuteilung-name--fett" : "zuteilung-name--grau";
}

/** Hinweis hinter dem Schiffsnamen: die (voraussichtlich) zugeteilten
 *  Lotsen in Klammern, farblich nach Herkunft/Status (siehe
 *  zuteilungNameKlasse) — bei Vorschau-Kandidaten mit "⚠️" markiert, wenn
 *  sie voraussichtlich zu spät ankommen. Bleiben Plätze unbesetzbar, wird
 *  zusätzlich "X Lotse(n) benötigt" angehängt; der Schiffsname selbst wird
 *  in diesem Fall separat (siehe schiffKlasse in der Tabelle) rot. */
function ZuteilungsHinweis({
  zuteilung,
  angemeldet,
}: {
  zuteilung: SeestationZuteilung | undefined;
  angemeldet: boolean;
}) {
  if (!zuteilung) return null;
  const { zugewiesen, fehlt } = zuteilung;
  return (
    <span className="planung-hinweis">
      {zugewiesen.length > 0 && (
        <>
          {" ("}
          {zugewiesen.map((slot, i) => (
            <Fragment key={slot.zeile.key}>
              {i > 0 && ", "}
              <span className={zuteilungNameKlasse(slot, angemeldet)}>
                {slot.zeile.aufStation ? slot.zeile.name : `${slot.zeile.name} ab ${formatUhrzeit(slot.zeile.etaStn)}`}
                {slot.verspaetet && slot.zeile.projiziert ? " ⚠️" : ""}
              </span>
            </Fragment>
          ))}
          {")"}
        </>
      )}
      {fehlt > 0 && (
        <span className="zuteilung-benoetigt">
          {" "}
          — {fehlt} Lotse{fehlt === 1 ? "" : "n"} benötigt
        </span>
      )}
    </span>
  );
}

export function Seestation() {
  const {
    seeSchiffe,
    addSeeSchiff,
    updateSeeSchiff,
    deleteSeeSchiff,
    abteilungen,
    updateAbteilung,
    seestationLotsen,
    addSeestationLotse,
    updateSeestationLotse,
    seeAbteilungen,
    teileSeeAb,
    jobs,
    lotsen,
    aktuelleFahrt,
    vNrStart,
    verbrauchteVNrn,
    vorschau,
    setVorschau,
  } = useData();

  // Bereits abgeteilte Lotsen je See-Schiff: voll abgeteilte Schiffe
  // verschwinden aus "ETA Seestation" (analog zu Tafel Brb/Einsatzplanung).
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen) abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);
  // "Lots." zeigt wie bei AG-Jobs in der Einsatzplanung die noch
  // verbleibende (nicht die ursprüngliche) Anzahl — sinkt mit jedem
  // Seestation-Abteilen.
  function verbleibendeLotsen(schiff: SeeSchiff): number {
    return seeLotsenAnzahl(schiff) - (abgeteiltProSchiff.get(schiff.id) ?? 0);
  }

  // Zeit-Tick wie im Dashboard: die Vorschau hängt an der Uhrzeit (früheste
  // AG-Ankunft, überfällige Abteilzeiten) und läuft so auch ohne
  // Datenänderung mit.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Zuteilungsreihenfolge: nach ETA, aber ein Schiff mit überfälliger
  // Anmeldung stellt sich bei der Lotsen-Vergabe hinten an (siehe
  // schiffePriorisiert) — es soll keinem bestätigten Schiff einen Lotsen
  // wegnehmen.
  const schiffeSortiert = schiffePriorisiert(seeSchiffe, abgeteiltProSchiff, jetzt);
  // Vorschau-Zusatzregeln (NUR bei aktiviertem Schalter): E3/St-Schiffe im
  // 3-Std.-Fenster bilden einen Verbund (eine Bootstour, Abt.Zeit des
  // ersten + 1 Min. je Folgeschiff, siehe vorschauAbtZeiten) und gewinnen
  // bei zeitgleicher Abt.Zeit vor normalen Schiffen — der Verbund gewinnt
  // gemeinsam (Prioritätszeit = führendes Schiff).
  const vorschauAbt = vorschau ? vorschauAbtZeiten(seeSchiffe) : undefined;
  const vorschauAbtZeitVon = vorschauAbt
    ? (schiff: SeeSchiff) => vorschauAbt.get(schiff.id)?.abtZeit ?? planungsEta(schiff)
    : undefined;
  const schiffeVorschauSortiert = vorschauAbt
    ? schiffePriorisiert(seeSchiffe, abgeteiltProSchiff, jetzt, vorschauAbt)
    : schiffeSortiert;
  // ANZEIGE ohne Vorschau rein chronologisch: auch ein Alarm-Schiff bleibt
  // an seiner zeitlichen Position (rot markiert), statt hinter Schiffen des
  // Folgetags zu landen. Mit Vorschau sortiert die Liste temporär nach der
  // BERECHNETEN Abt.Zeit (E3/St 1,5 Std. vor, Verbünde gemeinsam) — bei
  // Gleichstand E3/St zuerst. Die Zuteilung wird je Schiff über die ID
  // nachgeschlagen, die Reihenfolgen dürfen sich also unterscheiden.
  const schiffeAnzeige = [...schiffeSortiert].sort((a, b) => {
    if (vorschauAbt) return vergleicheVorschauAbt(a, b, vorschauAbt);
    const diff = a.eta.getTime() - b.eta.getTime();
    if (diff !== 0) return diff;
    // Bei zeitgleicher Anzeige steht das E3/St-Schiff zuerst — es wird
    // auch zuerst abgeteilt (gilt immer, nicht nur in der Vorschau).
    return Boolean(a.e3st) !== Boolean(b.e3st) ? (a.e3st ? -1 : 1) : 0;
  });
  // Lotsen: Versetzliste ("Lotsen im Revier") + manuell hinzugefügte,
  // einsortiert nach V-Nr. mit Zusatz-Reihenfolge (101 → 101 (A) → 102)
  const lotsenZeilen = sortiereSeestation([
    ...zeilenAusAbteilungen(abteilungen),
    ...zeilenAusSeestationLotsen(seestationLotsen),
  ]);
  // Basis-Zuteilung: echte Lotsen (auf Station oder unterwegs) — immer
  // sichtbar, unabhängig von der Vorschau. Zweistufig (siehe planeSeestation):
  // pünktliche Kandidaten zuerst, dann Rest mit Verspätungs-Kennzeichnung.
  const basisZuteilung = planeSeestation(schiffeSortiert, lotsenZeilen, abgeteiltProSchiff, VORLAUF_AUF_STATION_MS);

  // Vorschau: zuschaltbare Projektion, die zusätzlich die Lotsen der
  // Einsatzstation einrechnet — VERPLANTE (mit Job, kommen mit ihrem
  // Job-Schiff raus) und FREIE (noch ohne Job, per AG holbar) — mit
  // derselben zweistufigen Zuteilung wie die Basis.
  // Der Vorschau-Schalter lebt im DataContext — die Seestations-Kachel des
  // Dashboards zeigt dieselbe Projektion.
  const { verplante, freie } = vorschau
    ? vorschauZeilen(jobs, lotsen, aktuelleFahrt, abteilungen, settings, vNrStart, verbrauchteVNrn, jetzt)
    : { verplante: [], freie: [] };
  // Die Vorschau-Zuteilung nutzt die Vorschau-Zusatzregeln: Verbund-
  // Abt.Zeiten und E3/St-Vorrang (siehe schiffeVorschauSortiert oben).
  const vorschauZuteilung = vorschau
    ? planeSeestation(
        schiffeVorschauSortiert,
        sortiereSeestation([...lotsenZeilen, ...verplante, ...freie]),
        abgeteiltProSchiff,
        VORLAUF_AUF_STATION_MS,
        vorschauAbtZeitVon,
      )
    : undefined;
  const aktiveZuteilung = vorschauZuteilung ?? basisZuteilung;

  // Knapper Vorlauf: der Lotse ist zugeteilt, kommt aber weniger als eine
  // Stunde vor seinem Schiff an (siehe VORLAUF_WARNUNG_MS). Bewusst aus der
  // BASIS-Zuteilung — die Warnung beschreibt die echte Lage, unabhängig vom
  // Vorschau-Schalter, und deckt sich so mit dem Meldungspanel.
  const knappProKey = new Set<string>();
  for (const schiff of schiffeSortiert) {
    for (const slot of basisZuteilung.get(schiff.id)?.zugewiesen ?? []) {
      if (slot.zeile.aufStation || slot.zeile.etaStn === undefined) continue;
      if (schiff.eta.getTime() - slot.zeile.etaStn.getTime() < VORLAUF_WARNUNG_MS) {
        knappProKey.add(slot.zeile.key);
      }
    }
  }

  // VERPLANTE Kandidaten erscheinen immer — sie kommen mit ihrem Job-Schiff
  // ohnehin zur Seestation, ob ein ETA-Schiff sie braucht oder nicht. FREIE
  // Kandidaten (per AG erst noch zu holen) dagegen nur, wenn die Vorschau-
  // Zuteilung sie tatsächlich irgendeinem Schiff zuweist (egal ob pünktlich
  // oder verspätet) — der Rest bleibt als ungenutzter Pool unsichtbar. Die
  // Verspätung wird für die "Auf Seestation"-Zeile selbst mitgeführt.
  const verspaetetProKey = new Map<string, boolean>();
  if (vorschauZuteilung) {
    for (const zuteilung of vorschauZuteilung.values()) {
      for (const slot of zuteilung.zugewiesen)
        if (slot.zeile.projiziert) verspaetetProKey.set(slot.zeile.key, slot.verspaetet);
    }
  }
  // Vorschau-Lotsen anhand ihrer potentiellen V-Nr. zwischen die echten
  // Zeilen einsortieren — dort stünden sie später auch wirklich.
  const projizierte = [...verplante, ...freie.filter((z) => verspaetetProKey.has(z.key))];
  const anzeigeLotsen = sortiereSeestation([...lotsenZeilen, ...projizierte]);
  const zeilen = Math.max(schiffeAnzeige.length, anzeigeLotsen.length);

  const [schiffAuswahl, setSchiffAuswahl] = useState<number | null>(null);
  // Mehrere Lotsen wählbar, wenn das gewählte Schiff mehr als einen
  // benötigt (Doppeldecker) — sonst wie bisher eine einzelne Auswahl.
  const [lotseAuswahl, setLotseAuswahl] = useState<string[]>([]);
  const [neuesSchiffOffen, setNeuesSchiffOffen] = useState(false);
  const [editSchiff, setEditSchiff] = useState<SeeSchiff | null>(null);
  const [loeschenSchiff, setLoeschenSchiff] = useState<SeeSchiff | null>(null);
  const [aktionLotse, setAktionLotse] = useState<SeestationZeile | null>(null);
  const [abschoepfenLotse, setAbschoepfenLotse] = useState<SeestationZeile | null>(null);
  const [neuerLotseOffen, setNeuerLotseOffen] = useState(false);
  // "Abteilen": Rückfrage vor dem Verbinden von Schiff + Lotse
  const [abteilenFrage, setAbteilenFrage] = useState(false);
  // EH-Quick-Edit (Doppelklick auf die EH-Spalte "Auf Seestation"): kleines
  // Fenster wie in der Einsatzstation statt des sonstigen Aktionsfensters —
  // ein per "neue Wache" importierter Lotse hat dort keinen Datensatz, EH
  // wird hier direkt am Seestation-Eintrag gespeichert (siehe elbehafenAn).
  const [ehQuickEdit, setEhQuickEdit] = useState<{ zeile: SeestationZeile; left: number } | null>(null);
  const kopf = useRef<HTMLDivElement>(null);

  // Vorbelegung fürs Hinzufügen: letzte (höchste) V-Nr. der Revier-Lotsen
  const vNrProfil = zeilenAusAbteilungen(abteilungen).reduce((max, z) => Math.max(max, z.vNr), 0);

  // Aktuelle Auswahl für das Seestation-Abteilen — Button erscheint, sobald
  // ein Schiff und mindestens ein Lotse markiert sind. Aktiv wird er erst,
  // wenn das Schiff angemeldet ist und genau so viele Lotsen ausgewählt
  // sind, wie noch benötigt werden (bei Doppeldeckern also zwei, die
  // bereits vor Ort ("Auf Seestation") sein müssen).
  const abteilenSchiff = schiffAuswahl !== null ? (schiffeSortiert.find((s) => s.id === schiffAuswahl) ?? null) : null;
  const abteilenLotseZeilen = lotseAuswahl
    .map((key) => lotsenZeilen.find((z) => z.key === key))
    .filter((z): z is SeestationZeile => z !== undefined);
  const abteilenBenoetigt = abteilenSchiff ? verbleibendeLotsen(abteilenSchiff) : 0;
  const abteilenMoeglich =
    (abteilenSchiff?.angemeldet ?? false) &&
    abteilenLotseZeilen.length === abteilenBenoetigt &&
    abteilenLotseZeilen.every((z) => z.aufStation);
  const abteilenWarnungen = abteilenSchiff
    ? abteilenLotseZeilen
        .map((z, i) =>
          eignungsWarnungSeestation(abteilenSchiff, z, (abgeteiltProSchiff.get(abteilenSchiff.id) ?? 0) + i === 0),
        )
        .filter((w): w is string => w !== undefined)
    : [];
  const abteilenWarnung =
    abteilenWarnungen.length > 0 ? Array.from(new Set(abteilenWarnungen)).join(" / ") : undefined;

  function handleAbteilenJa() {
    if (!abteilenSchiff || abteilenLotseZeilen.length === 0) return;
    for (const lotse of abteilenLotseZeilen) {
      teileSeeAb(
        {
          seeSchiffId: abteilenSchiff.id,
          schiffsname: abteilenSchiff.schiffsname,
          lotsenQuelle: lotse.quelle,
          lotsenId: lotse.id,
          lotsenName: lotse.name,
          lotsenKategorie: lotse.kategorie,
          elbehafen: lotse.elbehafen,
          abteilZeit: new Date(),
        },
        lotse.quelle,
        lotse.id,
      );
    }
    setSchiffAuswahl(null);
    setLotseAuswahl([]);
    setAbteilenFrage(false);
  }

  const dennoch = abteilenWarnung ? "dennoch " : "";
  const abteilenFrageText =
    abteilenSchiff && abteilenLotseZeilen.length > 0
      ? `Soll${abteilenLotseZeilen.length > 1 ? "en" : ""} ${abteilenLotseZeilen.map((z) => z.name).join(" und ")} zu ${abteilenSchiff.schiffsname} ${dennoch}abgeteilt werden?`
      : "";

  function handleSchiffOk(schiff: SeeSchiff) {
    updateSeeSchiff(schiff.id, schiff);
    setSchiffAuswahl(null);
    setEditSchiff(null);
  }

  // Kat.-Dropdown auf Ebene der Modal-Überschrift: speichert sofort (wie
  // "aktuelle Fahrt" in der Einsatzstation), kein eigener OK-Button nötig.
  // editSchiff wird als lokale Kopie mitgeführt, damit ein anschließendes
  // "OK" des restlichen Formulars die neue Kat. nicht wieder überschreibt.
  function handleKategorieChange(wert: string) {
    if (!editSchiff) return;
    const aktualisiert = { ...editSchiff, kategorie: wert || undefined };
    updateSeeSchiff(editSchiff.id, aktualisiert);
    setEditSchiff(aktualisiert);
  }

  function handleSchiffLoeschenJa() {
    if (!loeschenSchiff) return;
    deleteSeeSchiff(loeschenSchiff.id);
    setSchiffAuswahl(null);
    setLoeschenSchiff(null);
  }

  function handleEtaStnUebernehmen(wert: Date | undefined) {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { etaStnManuell: wert });
    } else {
      updateSeestationLotse(aktionLotse.id, { etaStn: wert });
    }
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  function handleAufSeestation() {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { aufSeestation: true });
    } else {
      updateSeestationLotse(aktionLotse.id, { aufStation: true });
    }
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  // Verschieben (nur Versetzliste-Lotsen, quelle "abteilung"): der Lotse
  // verliert seine V-Nr. und bekommt die des Ziels mit Dezimal-Zusatz
  // (.1, .2, …) — mehrere Verschiebungen hinter dieselbe Basis-Nr. zählen
  // fortlaufend hoch (105 → 105.1 → 105.2 …). Maximal 9 Verschiebungen je
  // Basis: ein zehntes Kind ergäbe "105.10", was numerisch mit 105.1
  // kollidiert — volle Basen tauchen daher nicht mehr als Ziel auf.
  function anzahlKinder(basis: number): number {
    return abteilungen.filter((a) => a.vNr !== undefined && Math.floor(a.vNr) === basis && a.vNr !== basis).length;
  }
  const verschiebenZiele =
    aktionLotse && aktionLotse.quelle === "abteilung"
      ? lotsenZeilen
          .filter(
            (z) =>
              z.quelle === "abteilung" &&
              z.aufStation &&
              z.id !== aktionLotse.id &&
              anzahlKinder(Math.floor(z.vNr)) < 9,
          )
          .map((z) => ({ id: z.id, label: `${z.name} (${z.vNr})` }))
      : [];

  function handleVerschieben(zielAbteilungId: number) {
    if (!aktionLotse || aktionLotse.quelle !== "abteilung") return;
    const ziel = abteilungen.find((a) => a.id === zielAbteilungId);
    if (!ziel || ziel.vNr === undefined) return;
    const basis = Math.floor(ziel.vNr);
    const vorhandeneKinder = anzahlKinder(basis);
    if (vorhandeneKinder >= 9) return;
    const neueVNr = Number(`${basis}.${vorhandeneKinder + 1}`);
    updateAbteilung(aktionLotse.id, { vNr: neueVNr });
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  function handleAbschoepfenJa() {
    if (!abschoepfenLotse) return;
    if (abschoepfenLotse.quelle === "abteilung") {
      updateAbteilung(abschoepfenLotse.id, { abgeschoepft: true });
    } else {
      updateSeestationLotse(abschoepfenLotse.id, { abgeschoepft: true });
    }
    setLotseAuswahl([]);
    setAbschoepfenLotse(null);
  }

  function elbehafenAendern(wert: boolean) {
    if (!ehQuickEdit) return;
    const { zeile } = ehQuickEdit;
    if (zeile.quelle === "abteilung") {
      updateAbteilung(zeile.id, { elbehafen: wert });
    } else {
      updateSeestationLotse(zeile.id, { elbehafen: wert });
    }
    setEhQuickEdit(null);
  }

  const ehQuickTop = (kopf.current?.getBoundingClientRect().bottom ?? 0) + 6;

  return (
    <div>
      <div ref={kopf}>
        <PageHeader title="Seestation" centered />
      </div>
      <Panel
        actionLeft={
          <div className="seestation-kopf-links">
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuesSchiffOffen(true)}>
              + Neues Schiff
            </button>
            <button
              type="button"
              className={"btn btn--small" + (vorschau ? " btn--accent" : "")}
              onClick={() => setVorschau(!vorschau)}
            >
              Vorschau
            </button>
          </div>
        }
        action={
          <>
            {abteilenSchiff && abteilenLotseZeilen.length > 0 && (
              <button
                type="button"
                className="btn btn--accent seestation-abteilen"
                disabled={!abteilenMoeglich}
                onClick={() => setAbteilenFrage(true)}
              >
                Abteilen
              </button>
            )}
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuerLotseOffen(true)}>
              + Lotse hinzufügen
            </button>
          </>
        }
      >
        <div className="tabelle-scroll">
        <table className="seestation-table">
          <thead>
            <tr className="seestation-table__gruppen">
              <th colSpan={5}>ETA Seestation</th>
              <th className="seestation-table__divider" aria-hidden="true" />
              <th colSpan={5}>Auf Seestation</th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th className="num zentriert">ETA</th>
              <th>Schiffsname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">Lots.</th>
              <th className="seestation-table__divider" aria-hidden="true" />
              <th className="num zentriert">V-Nr.</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">EH</th>
              <th className="num zentriert kopf-umbruch">ETA Stn</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: zeilen }).map((_, i) => {
              const schiff = schiffeAnzeige[i];
              const lotse = anzeigeLotsen[i];
              const schiffZuteilung = schiff ? aktiveZuteilung.get(schiff.id) : undefined;
              const schiffDefizit = (schiffZuteilung?.fehlt ?? 0) > 0;
              const schiffKlasse =
                "seestation-table__seite" +
                (schiff && schiffAuswahl === schiff.id ? " ist-ausgewaehlt" : "") +
                (schiff?.angemeldet ? " fett" : "");
              // Abteilung Seestation überfällig: Abt.Zeit verstrichen, noch
              // nicht vollständig abgeteilt — unabhängig von der Anmeldung.
              // Bei E3/St zählt die um 1,5 Std. vorgezogene Abt.Zeit (siehe
              // planungsEta), nicht die rohe ETA.
              const schiffAbteilungUeberfaellig =
                schiff !== undefined &&
                jetzt.getTime() >= planungsEta(schiff).getTime() &&
                verbleibendeLotsen(schiff) > 0;
              // Anmeldung überfällig (Alarm) bzw. bald fällig (Warnung) —
              // dieselben Schwellen wie die Dashboard-Meldung (lib/meldungen.ts).
              const schiffAnmeldungRest = schiff ? schiff.eta.getTime() - jetzt.getTime() : Number.POSITIVE_INFINITY;
              const schiffAnmeldungAlarm =
                schiff !== undefined &&
                !schiff.angemeldet &&
                verbleibendeLotsen(schiff) > 0 &&
                schiffAnmeldungRest <= -ANMELDUNG_ESKALATION_MS;
              const schiffAnmeldungWarnung =
                schiff !== undefined &&
                !schiff.angemeldet &&
                verbleibendeLotsen(schiff) > 0 &&
                !schiffAnmeldungAlarm &&
                schiffAnmeldungRest <= ANMELDUNG_VORWARNUNG_MS;
              const etaKlasse = schiffAbteilungUeberfaellig || schiffAnmeldungAlarm
                ? " zeit-ueberfaellig"
                : schiffAnmeldungWarnung
                  ? " zeit-warnung"
                  : "";
              const lotseVerspaetet = lotse?.projiziert ? (verspaetetProKey.get(lotse.key) ?? false) : false;
              // Ankunft Seestation überfällig: echter (nicht projizierter)
              // Lotse noch nicht "Auf Seestation", ETA Stn schon verstrichen.
              const lotseAnkunftUeberfaellig =
                lotse !== undefined &&
                !lotse.projiziert &&
                !lotse.aufStation &&
                lotse.etaStn !== undefined &&
                jetzt.getTime() >= lotse.etaStn.getTime();
              const lotseVorlaufKnapp =
                lotse !== undefined && !lotse.projiziert && !lotseAnkunftUeberfaellig && knappProKey.has(lotse.key);
              const lotseKlasse =
                "seestation-table__seite" +
                (lotse && lotseAuswahl.includes(lotse.key) ? " ist-ausgewaehlt" : "") +
                (lotse?.aufStation ? " fett" : " gedimmt") +
                (lotse?.projiziert === "verplant"
                  ? lotseVerspaetet
                    ? " vorschau-orange vorschau-verspaetet"
                    : " vorschau-orange"
                  : lotse?.projiziert
                    ? lotseVerspaetet
                      ? " vorschau-blau vorschau-verspaetet"
                      : " vorschau-blau"
                    : "");
              const schiffKlick = schiff
                ? () => setSchiffAuswahl((aktiv) => (aktiv === schiff.id ? null : schiff.id))
                : undefined;
              const schiffDoppelklick = schiff
                ? () => {
                    setSchiffAuswahl(schiff.id);
                    setEditSchiff(schiff);
                  }
                : undefined;
              // Einfachauswahl, außer das gewählte Schiff braucht noch mehr
              // als einen Lotsen (Doppeldecker) — dann bis zu dessen
              // verbleibendem Bedarf mehrere gleichzeitig wählbar.
              // Projizierte Vorschau-Zeilen sind nicht anklickbar.
              const lotseKlick =
                lotse && !lotse.projiziert
                  ? () =>
                      setLotseAuswahl((aktuell) => {
                        if (aktuell.includes(lotse.key)) return aktuell.filter((k) => k !== lotse.key);
                        const kapazitaet = abteilenSchiff ? Math.max(verbleibendeLotsen(abteilenSchiff), 1) : 1;
                        if (aktuell.length >= kapazitaet) return [lotse.key];
                        return [...aktuell, lotse.key];
                      })
                  : undefined;
              const lotseDoppelklick =
                lotse && !lotse.projiziert
                  ? () => {
                      setLotseAuswahl([lotse.key]);
                      setAktionLotse(lotse);
                    }
                  : undefined;
              // EH-Spalte hat einen eigenen Doppelklick (Quick-Edit) statt
              // des sonstigen Aktionsfensters.
              const lotseEhDoppelklick =
                lotse && !lotse.projiziert
                  ? (e: React.MouseEvent<HTMLTableCellElement>) => {
                      setLotseAuswahl([lotse.key]);
                      setEhQuickEdit({ zeile: lotse, left: e.currentTarget.getBoundingClientRect().left });
                    }
                  : undefined;
              // Vorschau-Kennzeichnung: die berechnete Abt.Zeit (inkl.
              // Verbund-Zusammenlegung) steht unter der ETA — nur solange
              // die Vorschau aktiv ist und die Zeit tatsächlich abweicht
              // (bei angemeldeten E3/St-Schiffen ist die eingetragene Zeit
              // bereits die Abt.Zeit, dann entfällt der Hinweis).
              const abtInfoRoh = schiff ? vorschauAbt?.get(schiff.id) : undefined;
              const abtInfo =
                abtInfoRoh &&
                schiff &&
                (abtInfoRoh.abtZeit.getTime() !== schiff.eta.getTime() || abtInfoRoh.verbundGroesse > 1)
                  ? abtInfoRoh
                  : undefined;
              return (
                <tr key={i}>
                  {schiff ? (
                    <>
                      <td className={`${schiffKlasse} num muted`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {i + 1}
                      </td>
                      <td
                        className={`${schiffKlasse} num zentriert${schiff.e3st ? " eta-rot" : ""}${etaKlasse}`}
                        onClick={schiffKlick}
                        onDoubleClick={schiffDoppelklick}
                      >
                        {formatUhrzeit(schiff.eta)}
                        {abtInfo && (
                          <div className="eta-abt-vorschau">
                            Abt. {formatUhrzeit(abtInfo.abtZeit)}
                            {abtInfo.verbundGroesse > 1 && <div>(Verbund)</div>}
                          </div>
                        )}
                      </td>
                      <td
                        className={`${schiffKlasse} cell-name` + (schiffDefizit ? " zuteilung-defizit" : "")}
                        onClick={schiffKlick}
                        onDoubleClick={schiffDoppelklick}
                      >
                        {schiff.schiffsname}
                        <ZuteilungsHinweis zuteilung={schiffZuteilung} angemeldet={schiff.angemeldet ?? false} />
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {schiff.kategorie ?? "·"}
                        {schiff.ehfLotseBenoetigt && <span className="planung-hinweis"> (EH)</span>}
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {verbleibendeLotsen(schiff) > 1 ? verbleibendeLotsen(schiff) : ""}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                  <td className="seestation-table__divider" aria-hidden="true" />
                  {lotse ? (
                    <>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {Number.isFinite(lotse.vNr) ? lotse.vNr : "–"}
                        {lotse.zusatz && <span className="planung-hinweis"> ({lotse.zusatz})</span>}
                      </td>
                      <td className={`${lotseKlasse} cell-name`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.name}
                        {lotseVerspaetet ? " ⚠️" : ""}
                      </td>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.kategorie}
                      </td>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseEhDoppelklick}>
                        {lotse.elbehafen ? "✓" : ""}
                      </td>
                      <td
                        className={
                          `${lotseKlasse} num zentriert` +
                          (lotseAnkunftUeberfaellig ? " zeit-ueberfaellig" : lotseVorlaufKnapp ? " zeit-warnung" : "")
                        }
                        onClick={lotseKlick}
                        onDoubleClick={lotseDoppelklick}
                      >
                        {lotse.aufStation ? "–" : formatUhrzeit(lotse.etaStn)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Panel>

      {neuesSchiffOffen && (
        <Modal title="Neues Schiff" onClose={() => setNeuesSchiffOffen(false)} maxWidth="420px">
          <SeeSchiffNeuModal
            onEinfuegen={(schiff) => {
              addSeeSchiff(schiff);
              setNeuesSchiffOffen(false);
            }}
            onAbbrechen={() => setNeuesSchiffOffen(false)}
          />
        </Modal>
      )}

      {editSchiff && (
        <Modal
          title={editSchiff.schiffsname}
          onClose={() => setEditSchiff(null)}
          maxWidth="360px"
          titelZentriert
          headerExtra={
            <SchiffKatSelect
              value={editSchiff.kategorie ?? ""}
              onChange={handleKategorieChange}
              className="modal__head-select"
            />
          }
        >
          <SeeSchiffEditModal
            schiff={editSchiff}
            onOk={handleSchiffOk}
            onLoeschen={() => {
              setLoeschenSchiff(editSchiff);
              setEditSchiff(null);
            }}
            onAbbrechen={() => setEditSchiff(null)}
          />
        </Modal>
      )}

      {loeschenSchiff && (
        <Modal title="Schiff löschen" onClose={() => setLoeschenSchiff(null)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={`Soll ${loeschenSchiff.schiffsname} wirklich gelöscht werden?`}
            zentriert
            onJa={handleSchiffLoeschenJa}
            onNein={() => setLoeschenSchiff(null)}
          />
        </Modal>
      )}

      {aktionLotse && (
        <Modal title={aktionLotse.name} onClose={() => setAktionLotse(null)} maxWidth="440px">
          <SeestationLotseAktionModal
            initialEtaStn={aktionLotse.etaStn}
            aufStation={aktionLotse.aufStation}
            zeigeVerschieben={aktionLotse.quelle === "abteilung"}
            verschiebenZiele={verschiebenZiele}
            onUebernehmen={handleEtaStnUebernehmen}
            onAufStation={handleAufSeestation}
            onVerschieben={handleVerschieben}
            onAbschoepfen={() => {
              setAbschoepfenLotse(aktionLotse);
              setAktionLotse(null);
            }}
            onAbbrechen={() => setAktionLotse(null)}
          />
        </Modal>
      )}

      {abschoepfenLotse && (
        <Modal title="Lotse abschöpfen" onClose={() => setAbschoepfenLotse(null)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={`Lotsen ${abschoepfenLotse.name} wirklich abschöpfen?`}
            zentriert
            onJa={handleAbschoepfenJa}
            onNein={() => setAbschoepfenLotse(null)}
          />
        </Modal>
      )}

      {neuerLotseOffen && (
        <Modal title="Lotse hinzufügen" onClose={() => setNeuerLotseOffen(false)} maxWidth="440px">
          <SeestationLotseNeuModal
            vNrProfil={vNrProfil}
            // Prüfung über ALLE manuellen Datensätze (auch abgeschöpfte/
            // see-abgeteilte) — die können per Rückgängig zurückkehren.
            istVergeben={(vNr, zusatz) => seestationLotsen.some((l) => l.vNr === vNr && l.zusatz === zusatz)}
            onEinfuegen={(lotse) => {
              addSeestationLotse(lotse);
              setNeuerLotseOffen(false);
            }}
            onAbbrechen={() => setNeuerLotseOffen(false)}
          />
        </Modal>
      )}

      {abteilenFrage && abteilenSchiff && abteilenLotseZeilen.length > 0 && (
        <Modal title="Abteilen" onClose={() => setAbteilenFrage(false)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={abteilenFrageText}
            warnung={abteilenWarnung}
            zentriert
            onJa={handleAbteilenJa}
            onNein={() => setAbteilenFrage(false)}
          />
        </Modal>
      )}

      {ehQuickEdit && (
        <QuickEditPopover titel="EH" top={ehQuickTop} left={ehQuickEdit.left} onClose={() => setEhQuickEdit(null)}>
          <select
            value={ehQuickEdit.zeile.elbehafen ? "ja" : "nein"}
            onChange={(e) => elbehafenAendern(e.target.value === "ja")}
          >
            <option value="ja">✓ Elbehafen</option>
            <option value="nein">– kein Elbehafen</option>
          </select>
        </QuickEditPopover>
      )}
    </div>
  );
}
