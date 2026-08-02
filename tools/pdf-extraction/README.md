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
  "hh_liste": [ { "nr", "hh", "fkw", "std", "bem" } ],
  "holt_kuden": [ { "nr", "holt", "kuden", "kat", "bem" } ],
  "anmeldungen_ausgehend": [ { "nr", "typ", "kat", "lotse", "datum_zeit" } ],
  "lotsenliste": [ { "tafel", "cb", "name", "bb", "bem" } ],
  "eingehende_schiffe": [ { "nr", "kat", "eta", "bestimmung", "schiffsname" } ],
  "_unparsed": [ /* Zeilen, die keiner Sektion zugeordnet werden konnten */ ]
}
```

## Testergebnis (anonymisiert, Struktur-Validierung)

Gegen einen echten Beispiel-Export (02.08.2026) validiert:

| Abschnitt               | Zeilen extrahiert | Kontrolle                          |
|--------------------------|-------------------|-------------------------------------|
| `ft_zurueck`             | 19                | vollständig                         |
| `hh_liste`               | 10                | vollständig (inkl. Leerslots)       |
| `holt_kuden`              | 10                | vollständig (inkl. Leerslots)       |
| `anmeldungen_ausgehend`  | 5                 | vollständig                         |
| `lotsenliste`            | 83                | 83/83 Zeilen — exakt                |
| `eingehende_schiffe`     | 44                | Nr. 1–44 lückenlos                  |
| `_unparsed`              | 1                 | Fußnoten-Zeile ("N N2 N2"), unkritisch |

**Achtung:** Das Test-PDF enthält reale Namen/Schiffsdaten und wird
absichtlich **nicht** ins Repo committet (siehe `.gitignore`). Zum erneuten
Testen lokal in `tools/pdf-extraction/testdata/` ablegen.

## Offene Fragen (fachliche Klärung nötig)

Die Struktur wurde rein aus dem PDF-Layout abgeleitet — die Bedeutung
einiger Felder ist mir als Nicht-Lotse nicht klar. Bitte prüfen/klären:

- **`lotsenliste`**: Spalten `tafel`, `cb`, `bb` scheinen unterschiedliche,
  verschachtelte Nummerierungen/Listen zu sein (Haupt-Warteliste vs.
  Untergruppen?). Was bedeuten `CB` und `BB` genau, und wie hängen die drei
  Nummern zusammen?
- **`hh_liste`** ("6 / HH / FKW / STD / Bem."): Wofür stehen `HH`, `FKW`,
  `STD`? Vermutlich Zeiten/Kürzel für einen bestimmten Warte-/Treffpunkt.
- **`holt_kuden`** ("Holt. / Kuden / Kat / Bem"): Vermutlich Abhol-/
  Ankunftszeiten, aber Bedeutung von "Kuden" unklar.
- **`anmeldungen_ausgehend`**: Ist das tatsächlich die "ausgehende Jobs"-Liste,
  oder etwas anderes (Sonderanmeldungen für Wegpunkte)?

Sobald das geklärt ist, sollten die generischen Feldnamen durch sprechende
Namen ersetzt und die Daten in die eigentliche App-Datenstruktur (Jobs /
Lotsen, ein-/ausgehend) übersetzt werden.

## Bekannte Grenzen

- Nur getestet an **einem** Beispiel-Export. Vor produktivem Einsatz braucht
  es mehrere Exporte aus verschiedenen Schichten/Situationen, um zu prüfen,
  ob die Template-Struktur wirklich stabil bleibt.
- Kein Fallback, falls sich das Seiten-Template ändert — der Parser würde
  dann Abschnitte falsch zuordnen oder in `_unparsed` verlieren, ohne
  laut zu scheitern. Für den Produktivbetrieb sollte eine Validierung
  ergänzt werden (z.B. Plausibilitätschecks, oder ein LLM-gestützter
  Extraktions-Fallback für mehr Robustheit gegenüber Layout-Drift).
