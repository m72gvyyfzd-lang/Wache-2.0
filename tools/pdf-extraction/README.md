# PDF-Extraktion: Wache-Tafel (elbe-pilot.de)

Prototyp, der den PDF-Export der `BZ2 Tafel` von elbe-pilot.de/boert in
strukturiertes JSON umwandelt — ohne die Zugangsdaten der Website zu nutzen.
Der Einsatzleiter druckt die Seite als PDF, dieses Skript liest es aus.

## Warum kein Login/Scraping?

Bewusste Entscheidung: keine Zugangsdaten in der App speichern oder für
automatisierte Requests nutzen. Stattdessen wird ein manuell erzeugter
PDF-Export analysiert.

## Funktionsweise

Das PDF enthält "echte" PDF-Tabellen mit sichtbaren Rasterlinien (kein
Scan/Bild) — `pdfplumber` kann die Zellen daher zuverlässig und ohne OCR
extrahieren. Der Parser erkennt die Abschnitte anhand ihrer (offenbar fest
vom Seiten-Template vorgegebenen) deutschen Spaltenüberschriften, nicht
anhand fester Zeilen-/Spaltenpositionen — das macht ihn robust gegenüber
wechselnden Inhalten (Anzahl Jobs/Lotsen ändert sich jede Wache), aber
**nicht** gegenüber Änderungen am Seiten-Template selbst.

## Setup & Nutzung

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python3 parse_wache_pdf.py wache.pdf output.json
```

## Ausgabe-Schema

```jsonc
{
  "meta": {
    "wache_station": "PHL",
    "datum": "02.08.26",
    "zeit": "11:57",
    "fahrt": { "typ": "MoFA", "von": "Brb", "nach": "Cux" },
    "tiden": { "Tide Brb": "...", "Tide Cux": "..." },
    "kopfdaten": [ /* sonstige Kopfzeilen, roh */ ]
  },
  "ft_zurueck": [ { "ft_zurueck": "...", "kat": "...", "bem": "..." } ],
  // Schiff verlässt Hamburger Hafen Richtung Brunsbüttel (Elbe-Route),
  // Fortschritt an 3 Meldepunkten
  "ausgehend_hamburg": [ {
    "nr",
    "zeit_hamburg_hafen_verlassen",   // geplante Abfahrtszeit Hamburg Hafen
    "zeit_finkenwerder_passage",      // Ist-Zeit Passage Finkenwerder = Schiff wirklich unterwegs
    "zeit_stade_passage",             // Passage Stade, ~1h bis Brunsbüttel (tideabhängig)
    "bem"
  } ],
  // Schiff im NOK (Nord-Ostsee-Kanal) Richtung Brunsbüttel
  "ausgehend_nok": [ {
    "nr",
    "zeit_holtenau_ausfahrt",  // Zeit Schleusenausfahrt Kiel-Holtenau
    "zeit_kuden_passage",      // Passage Kuden, ~1h bis Brunsbüttel
    "kat",
    "bem"
  } ],
  // weitere Jobs (Typen u.a. Radar, W-Blau, NW-Cux, EHF) — keine feste
  // Ein-/Ausgehend-Kategorie
  "anmeldungen": [ { "nr", "typ", "kat", "lotse", "datum_zeit" } ],
  "lotsenliste": [ {
    "position_haupt",              // "Tafel": Hauptreihenfolge/Warteliste
    "position_cuxhaven_boert",     // "CB": Cuxhaven Bört — für diese Wache nicht relevant
    "name",
    "position_brunsbuettel_boert", // "BB": Brunsbüttel Bört — relevante Warteliste
    "bem"
  } ],
  "eingehende_schiffe": [ { "nr", "kat", "eta", "bestimmung", "schiffsname" } ],
  "_unparsed": [ /* Zeilen, die keiner Sektion zugeordnet werden konnten */ ]
}
```

## Testergebnis (anonymisiert, Struktur-Validierung)

Gegen einen echten Beispiel-Export (02.08.2026) validiert:

| Abschnitt               | Zeilen extrahiert | Kontrolle                          |
|--------------------------|-------------------|-------------------------------------|
| `ft_zurueck`             | 19                | vollständig                         |
| `ausgehend_hamburg`      | 10                | vollständig (inkl. Leerslots)       |
| `ausgehend_nok`          | 10                | vollständig (inkl. Leerslots)       |
| `anmeldungen`           | 5                 | vollständig                         |
| `lotsenliste`            | 83                | 83/83 Zeilen — exakt                |
| `eingehende_schiffe`     | 44                | Nr. 1–44 lückenlos                  |
| `_unparsed`              | 1                 | Fußnoten-Zeile ("N N2 N2"), unkritisch |

**Achtung:** Das Test-PDF enthält reale Namen/Schiffsdaten und wird
absichtlich **nicht** ins Repo committet (siehe `.gitignore`). Zum erneuten
Testen lokal in `tools/pdf-extraction/testdata/` ablegen.

## Geklärte Semantik

- **`lotsenliste`**: `position_haupt` (früher "Tafel") ist die
  Hauptreihenfolge/Warteliste. `position_cuxhaven_boert` (CB) ist eine
  separate Warteliste für Cuxhaven Bört — für eine Brunsbüttel-Wache nicht
  relevant. `position_brunsbuettel_boert` (BB) ist die relevante Warteliste
  für Brunsbüttel Bört.
- **`ausgehend_hamburg`**: verfolgt ein Schiff, das den Hamburger Hafen
  Richtung Brunsbüttel verlässt (Elbe-Route), an drei Meldepunkten
  (Hamburg → Finkenwerder → Stade).
- **`ausgehend_nok`**: verfolgt ein Schiff im Nord-Ostsee-Kanal (NOK)
  Richtung Brunsbüttel (Holtenau-Ausfahrt → Kuden-Passage).
- **`anmeldungen`**: weitere Jobs (Typen u.a. Radar, W-Blau, NW-Cux, EHF),
  die aber nicht generell als "ausgehend" kategorisiert werden können —
  daher ohne Richtungs-Label im Namen.

Die generischen Feldnamen innerhalb von `anmeldungen` (`typ`, `kat`, `lotse`)
sollten bei Bedarf noch weiter präzisiert werden, sobald klar ist, wie diese
Jobs in die eigentliche App-Datenstruktur (Jobs / Lotsen, ein-/ausgehend)
einsortiert werden.

## Bekannte Grenzen

- Nur getestet an **einem** Beispiel-Export. Vor produktivem Einsatz braucht
  es mehrere Exporte aus verschiedenen Schichten/Situationen, um zu prüfen,
  ob die Template-Struktur wirklich stabil bleibt.
- Kein Fallback, falls sich das Seiten-Template ändert — der Parser würde
  dann Abschnitte falsch zuordnen oder in `_unparsed` verlieren, ohne
  laut zu scheitern. Für den Produktivbetrieb sollte eine Validierung
  ergänzt werden (z.B. Plausibilitätschecks, oder ein LLM-gestützter
  Extraktions-Fallback für mehr Robustheit gegenüber Layout-Drift).
