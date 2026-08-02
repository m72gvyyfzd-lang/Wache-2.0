# Wache 2.0

Web-App zur Live-Einsatzplanung von Elbe-Lotsen. Unterstützt den Einsatzleiter
(Dispatcher) dabei, verfügbare Lotsen zur richtigen Zeit den passenden
ein- und ausgehenden Jobs zuzuteilen.

- Optimiert für iPad-Nutzung, installierbar als Homescreen-Kachel (PWA)
- Zwei Kernlisten: eingehende Jobs / ausgehende Jobs, jeweils mit Liste der
  verfügbaren Lotsen
- Hochgradig modular — Inhalte ändern sich laufend während einer Wache

## Status

Frühe Konzept-/Testphase. Aktuell in Arbeit: automatisches Einlesen der
Schicht-Startdaten aus einem PDF-Export der (zugangsbeschränkten)
elbe-pilot.de Wache-Tafel — siehe [`tools/pdf-extraction`](tools/pdf-extraction).
Es werden bewusst keine Zugangsdaten der Website in der App gespeichert oder
genutzt; stattdessen wird ein manuell erzeugter PDF-Ausdruck analysiert.
