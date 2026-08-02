"""
Prototype parser for "Wache"-PDF exports from elbe-pilot.de/boert (BZ2 Tafel).

The site's PDF export uses a fixed set of German section headers even though
the row *content* (jobs, pilots, ship counts) changes every shift. This parser
splits the page-by-page lattice tables into named sections by matching those
header rows, rather than hard-coding row counts or positions.

Domain notes (clarified by a working pilot dispatcher, see
tools/pdf-extraction/README.md):

- Lotsenliste: "Tafel" = Hauptreihenfolge (main queue). "CB" = Cuxhaven
  Bört (separate waitlist, not relevant for a Brunsbüttel-bound watch).
  "BB" = Brunsbüttel Bört (the relevant waitlist for this watch).
- ausgehend_hamburg (formerly "HH/FKW/STD"): tracks a ship leaving Hamburg
  harbor down the Elbe towards Brunsbüttel at three checkpoints — HH =
  planned time leaving Hamburg harbor, FKW = actual Finkenwerder passage
  (ship is now really underway), STD = Stade passage (~1h from Brunsbüttel,
  tide-dependent).
- ausgehend_nok (formerly "Holt./Kuden"): tracks a ship in the Kiel Canal
  (Nord-Ostsee-Kanal) towards Brunsbüttel — Holt. = time it locked out of
  Kiel-Holtenau, Kuden = Kuden passage (~1h from Brunsbüttel).

Usage:
    python3 parse_wache_pdf.py <input.pdf> [output.json]
"""

import json
import re
import sys

import pdfplumber

FOOTER_RE = re.compile(r"^tps://|Seite \d+ von", re.IGNORECASE)


def clean_cell(v):
    if v is None:
        return ""
    return " ".join(str(v).split())


def is_blank_row(row):
    return all(clean_cell(c) == "" for c in row)


def trim_margin_columns(table_rows):
    """Drop columns that are empty across *every* row of this table, but only
    a contiguous run from the left and right edges — this removes the
    page-margin artifact columns pdfplumber adds around the real grid
    without breaking alignment of ragged/nested rows in the middle."""
    if not table_rows:
        return table_rows
    width = max(len(r) for r in table_rows)
    padded = [r + [""] * (width - len(r)) for r in table_rows]

    def col_all_empty(i):
        return all(row[i] == "" for row in padded)

    left = 0
    while left < width and col_all_empty(left):
        left += 1
    right = width
    while right > left and col_all_empty(right - 1):
        right -= 1
    return [row[left:right] for row in padded]


def load_rows(pdf_path):
    """Flatten every page's lattice table into one row stream, dropping
    footer/page-break noise and page-margin columns."""
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.find_tables():
                raw = []
                for row in table.extract():
                    cells = [clean_cell(c) for c in row]
                    if is_blank_row(cells):
                        continue
                    if any(FOOTER_RE.search(c) for c in cells):
                        continue
                    raw.append(cells)
                rows.extend(trim_margin_columns(raw))
    return rows


def row_starts_with(row, *labels):
    return all(
        i < len(row) and row[i] == label for i, label in enumerate(labels)
    )


def parse(pdf_path):
    rows = load_rows(pdf_path)
    result = {
        "meta": {},
        "ft_zurueck": [],
        "ausgehend_hamburg": [],
        "ausgehend_nok": [],
        "anmeldungen_ausgehend": [],
        "lotsenliste": [],
        "eingehende_schiffe": [],
        "_unparsed": [],
    }

    section = "meta"
    for row in rows:
        # --- section header detection -------------------------------------
        if row_starts_with(row, "Wache"):
            section = "meta"
            result["meta"]["wache_station"] = row[1] if len(row) > 1 else ""
            result["meta"]["datum"] = row[2] if len(row) > 2 else ""
            result["meta"]["zeit"] = row[4] if len(row) > 4 else ""
            continue
        if row_starts_with(row, "Fahrt"):
            result["meta"]["fahrt"] = {
                "typ": row[1] if len(row) > 1 else "",
                "von": row[2] if len(row) > 2 else "",
                "nach": row[3] if len(row) > 3 else "",
            }
            continue
        if row and row[0].startswith("Tide "):
            result["meta"].setdefault("tiden", {})[row[0]] = row[1] if len(row) > 1 else ""
            continue
        if row_starts_with(row, "FT zurück"):
            section = "ft_zurueck"
            continue
        if len(row) >= 3 and row[1] == "HH" and row[2] == "FKW":
            section = "ausgehend_hamburg"
            continue
        if len(row) >= 3 and row[1] == "Holt." and row[2] == "Kuden":
            section = "ausgehend_nok"
            continue
        if row_starts_with(row, "Nr", "Typ", "Kat.", "Lotse"):
            section = "anmeldungen_ausgehend"
            continue
        if row_starts_with(row, "Tafel", "CB", "Name", "BB"):
            section = "lotsenliste"
            continue
        if row_starts_with(row, "Nr.", "Kat", "ETA", "Best."):
            section = "eingehende_schiffe"
            continue

        # --- lines that are just informational, not a new section ---------
        if row[0] in ("in der Fahrt", "Freie Tage", "Urlauber", "Radar bis:", "Bem. 1", "1 + 1"):
            result["meta"].setdefault("kopfdaten", []).append(row)
            continue
        if row[0] in ("lose HH", "Zulauf", "Seestation") or "Anmeldungen" in row:
            result["meta"].setdefault("kopfdaten", []).append(row)
            continue
        # standalone annotation lines like "11 ETA heute" / "weitere 16 ETA"
        if row[0] == "weitere" or "ETA" in row[:3]:
            result["meta"].setdefault("kopfdaten", []).append(row)
            continue

        # --- row belongs to current section --------------------------------
        if section == "ft_zurueck" and len(row) >= 3:
            result["ft_zurueck"].append({
                "ft_zurueck": row[0],
                "kat": row[1] if len(row) > 1 else "",
                "bem": row[2] if len(row) > 2 else "",
            })
        elif section == "ausgehend_hamburg" and len(row) >= 4:
            result["ausgehend_hamburg"].append({
                "nr": row[0],
                "zeit_hamburg_hafen_verlassen": row[1],
                "zeit_finkenwerder_passage": row[2],
                "zeit_stade_passage": row[3],
                "bem": row[4] if len(row) > 4 else "",
            })
        elif section == "ausgehend_nok" and len(row) >= 4:
            result["ausgehend_nok"].append({
                "nr": row[0],
                "zeit_holtenau_ausfahrt": row[1],
                "zeit_kuden_passage": row[2],
                "kat": row[3],
                "bem": row[4] if len(row) > 4 else "",
            })
        elif section == "anmeldungen_ausgehend" and len(row) >= 4:
            result["anmeldungen_ausgehend"].append({
                "nr": row[0], "typ": row[1], "kat": row[2], "lotse": row[3],
                "datum_zeit": row[4] if len(row) > 4 else "",
            })
        elif section == "lotsenliste" and len(row) >= 3:
            result["lotsenliste"].append({
                "position_haupt": row[0],
                "position_cuxhaven_boert": row[1],
                "name": row[2],
                "position_brunsbuettel_boert": row[3] if len(row) > 3 else "",
                "bem": row[4] if len(row) > 4 else "",
            })
        elif section == "eingehende_schiffe" and len(row) >= 4:
            result["eingehende_schiffe"].append({
                "nr": row[0], "kat": row[1], "eta": row[2],
                "bestimmung": row[3], "schiffsname": row[4] if len(row) > 4 else "",
            })
        else:
            result["_unparsed"].append(row)

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: parse_wache_pdf.py <input.pdf> [output.json]", file=sys.stderr)
        sys.exit(1)
    data = parse(sys.argv[1])
    out = json.dumps(data, ensure_ascii=False, indent=2)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w") as f:
            f.write(out)
        print(f"Wrote {sys.argv[2]}")
        print(f"unparsed rows: {len(data['_unparsed'])}")
    else:
        print(out)
