# Wache 2.0

Web-App zur Live-Einsatzplanung von Elbe-Lotsen. Unterstützt den Einsatzleiter
(Dispatcher) dabei, verfügbare Lotsen zur richtigen Zeit den passenden
ein- und ausgehenden Jobs zuzuteilen.

- Optimiert für iPad-Nutzung, installierbar als Homescreen-Kachel (PWA)
- Zwei Kernlisten: eingehende Jobs / ausgehende Jobs, jeweils mit Liste der
  verfügbaren Lotsen
- Hochgradig modular — Inhalte ändern sich laufend während einer Wache

## Projektstruktur

- [`web/`](web) — React + Vite PWA, das eigentliche Grundgerüst der App.
  Navigations-Shell mit vier Bereichen (Zulauf Hamburg, Zulauf NOK,
  Anmeldungen, Lotsenliste), aktuell mit frei erfundenen Platzhalterdaten.
- [`core/`](core) — framework-unabhängige TypeScript-Kernlogik
  (Abteilzeit-/Anruf-Algorithmen, destilliert aus dem bisherigen
  Excel/Numbers-Tool), noch nicht an `web/` angebunden.
- [`tools/pdf-extraction`](tools/pdf-extraction) — Python-Skript, das den
  PDF-Export der (zugangsbeschränkten) elbe-pilot.de Wache-Tafel in
  strukturiertes JSON umwandelt, ohne die Zugangsdaten der Website zu
  nutzen. Noch nicht mit `web/` verbunden.

## Status

Frühe Konzept-/Testphase. Das App-Grundgerüst (`web/`) steht mit
Platzhalterdaten; die einzelnen Bausteine (PDF-Extraktion, Kernlogik) sind
noch nicht miteinander verdrahtet.
