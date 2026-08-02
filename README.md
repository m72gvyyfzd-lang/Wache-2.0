# Wache 2.0

Web-App zur Live-Einsatzplanung von Elbe-Lotsen. Unterstützt den Einsatzleiter
(Dispatcher) dabei, verfügbare Lotsen zur richtigen Zeit den passenden
Jobs zuzuteilen.

- Optimiert für iPad-Nutzung, installierbar als Homescreen-Kachel (PWA)
- Grundprinzip: eine Jobs-Warteschlange (HH + NOK + Anmeldungen, sortiert
  nach berechneter Abteilzeit) wird Zeile für Zeile mit der Lotsen-Warteschlange
  abgeglichen
- Hochgradig modular — Inhalte ändern sich laufend während einer Wache

## Live

https://m72gvyyfzd-lang.github.io/Wache-2.0/ (aktueller Stand von `main`,
automatisch deployed über `.github/workflows/deploy-pages.yml`)

**Einmalige Einrichtung** (falls die Seite 404 zeigt): GitHub Pages muss im
Repo einmal manuell aktiviert werden — der Workflow kann das nicht selbst,
das GITHUB_TOKEN hat dafür keine Berechtigung. Unter *Settings → Pages →
Build and deployment → Source* auf **"GitHub Actions"** stellen, danach
läuft jeder weitere Deploy automatisch.

## Projektstruktur

- [`web/`](web) — React + Vite PWA, das App-Grundgerüst. Navigations-Shell
  mit Dashboard, Einsatzplanung (Jobs- und Lotsen-Warteschlange zeilenweise
  nebeneinander) und Lotsenliste. An `core/` angebunden über npm-Workspaces —
  die Abteilzeiten sind echte Berechnungen, aber noch mit frei erfundenen
  Platzhalterdaten statt einer echten Datenquelle.
- [`core/`](core) — framework-unabhängige TypeScript-Kernlogik
  (Abteilzeit-/Anruf-Algorithmen, vereinheitlichte Jobs-Warteschlange),
  destilliert aus dem bisherigen Excel/Numbers-Tool. 36 Tests.
- [`tools/pdf-extraction`](tools/pdf-extraction) — Python-Skript, das den
  PDF-Export der (zugangsbeschränkten) elbe-pilot.de Wache-Tafel in
  strukturiertes JSON umwandelt, ohne die Zugangsdaten der Website zu
  nutzen. Noch nicht mit `web/` verbunden.

## Status

Frühe Konzept-/Testphase. Grundgerüst und Kernlogik stehen und sind
miteinander verdrahtet; es fehlen noch eine echte Datenquelle (statt
Platzhalterdaten) und die vielen besprochenen Sonderfälle/Bedingungen.
