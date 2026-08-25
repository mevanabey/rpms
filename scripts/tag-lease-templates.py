#!/usr/bin/env python3
"""Build docxtemplater-tagged template copies of the firm's lease drafts.

Best-effort:
 - Replaces clean, value-only yellow-highlighted spans with `{tag}` placeholders
   (mapped by the firm's numbered markers: (6.a), (8.a), (11), (13), …).
 - Replaces the rent-schedule paragraph block with a single
   `{@rentScheduleXml}` placeholder for the runtime renderer to fill.
 - Leaves whole-clause highlights (termination / renewal / management /
   service charges) untouched — those need manual `{tag}` insertion in Word.

Outputs: public/lease-templates/{residential,commercial}.docx
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ET.register_namespace("w", W)
NSW = "{" + W + "}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "new" / "lease-drafts"
OUT = ROOT / "public" / "lease-templates"

RES_MAP = {
    "(6.a)": "{lessorName}",
    "(6.b)": "No. {lessorReg}",
    "(7)":   "{lessorAddress}",
    "(8.a)": "{lesseeName}",
    "(8.b)": "No. {lesseeReg}",
    "(10)":  "{lesseeAddress}",
    "(11)":  "“{building}”",
    "(13)":  "{term}",
    "(19)":  "{stampDutyConsideration}",
    "(16.a)":"{deposit}",
    "(16.b)":"{depositTotal}",
    "(18)":  "{fxBasis}",
    "(21)":  "not exceed {occupancy} persons",
    "(22)":  "{minorRepairs}",
    "(23)":  "{handover}",
    "(24)":  "{cleaningFee}",
    "(1.a)": "{assessment1}",
    "(1.b)": "{assessment2}",
    "(12.a)":"{parcel1}",
    "(12.b)":"{parcel2}",
}

COM_MAP = {
    "(6.a)": "{lessorName}",
    "(6.b)": "(Holder of National Identity Card No. {lessorReg})",
    "(7)":   "{lessorAddress}",
    "(8.a)": "{lesseeName}",
    "(8.b)": "{lesseeReg}",
    "(9)":   "{lesseeAddress}",
    "(1)":   "{assessmentNo}",
    "(10)":  "{floors}",
    "(11)":  "{extent}",
    "(16)":  "refundable deposit amounting to {deposit}",
    "(13)":  "{term}",
}

# Whole-clause markers — leave untouched (user verifies/tags in Word).
WHOLE_CLAUSE_RES = {"(25)", "(26)", "(31)", "(32)", "(35)", "(37)"}
WHOLE_CLAUSE_COM = {"(15)", "(17)", "(19)", "(21)", "(23)", "(28)", "(30)", "(31)", "(32)", "(33)", "(34.a)", "(34.b)", "(35)", "(38)"}

# Schedule markers — handled by the rent-schedule block replacement.
SCHEDULE_RES = {"(14)", "(15.a)", "(15.b)", "(44)", "(45)", "(46)", "(47)"}
SCHEDULE_COM = {"(14)"}


# Marker forms the firm uses (all normalised to "(N.x)" or "(N)"):
#   (6.a), (6.b), (1.a), (12.a)  — dotted
#   (6)(a), (8)(a), (4)(a)       — paren-paren, possibly with whitespace
#   (6), (7), (10), (11), (13)…  — plain
_RE_ANY = re.compile(
    r"\(\s*([0-9]+)\s*(?:\.\s*([a-z])\s*)?\)(?:\s*\(\s*([a-z])\s*\))?",
    re.I,
)


def normalize_marker(m: "re.Match") -> str:
    num = m.group(1)
    sub = m.group(2) or m.group(3)
    return f"({num}.{sub.lower()})" if sub else f"({num})"


def scan_markers(text: str):
    """Yield every marker token in `text` in document order."""
    for m in _RE_ANY.finditer(text):
        yield normalize_marker(m), m.end()


def parse_leading_marker(text: str):
    """If `text` begins with a marker (possibly after a comma/space), return it
    plus the remainder; otherwise (None, text)."""
    m = _RE_ANY.match(text.lstrip(", \t\n"))
    if not m:
        return None, text.strip()
    consumed = text.find(m.group(0)) + len(m.group(0))
    return normalize_marker(m), text[consumed:].strip()


def is_highlighted(r) -> bool:
    rpr = r.find(NSW + "rPr")
    return rpr is not None and rpr.find(NSW + "highlight") is not None


def run_text(r) -> str:
    return "".join((t.text or "") for t in r.iter(NSW + "t"))


def set_group_text(grp, text: str) -> None:
    """Replace the run-group's combined text with `text` in the first run; clear the rest."""
    if not grp:
        return
    first = grp[0]
    rpr = first.find(NSW + "rPr")
    if rpr is not None:
        hl = rpr.find(NSW + "highlight")
        if hl is not None:
            rpr.remove(hl)
    ts = list(first.findall(NSW + "t"))
    if ts:
        ts[0].text = text
        ts[0].set(XML_SPACE, "preserve")
        for extra in ts[1:]:
            first.remove(extra)
    else:
        t = ET.SubElement(first, NSW + "t")
        t.set(XML_SPACE, "preserve")
        t.text = text
    for r in grp[1:]:
        for t in r.findall(NSW + "t"):
            t.text = ""


def paragraph_text(p) -> str:
    return "".join((t.text or "") for t in p.iter(NSW + "t"))


def replace_schedule_block(body, start_anchor: str, end_anchor: str) -> bool:
    paras = list(body.findall(NSW + "p"))
    start_i = end_i = None
    for i, p in enumerate(paras):
        text = paragraph_text(p)
        if start_i is None and start_anchor in text:
            start_i = i
        elif start_i is not None and end_i is None and end_anchor in text:
            end_i = i
            break
    if start_i is None or end_i is None or end_i <= start_i + 1:
        return False
    to_remove = paras[start_i + 1 : end_i]
    body_children = list(body)
    insert_at = body_children.index(to_remove[0])
    placeholder = ET.Element(NSW + "p")
    r = ET.SubElement(placeholder, NSW + "r")
    t = ET.SubElement(r, NSW + "t")
    t.set(XML_SPACE, "preserve")
    t.text = "{@rentScheduleXml}"
    for elem in to_remove:
        body.remove(elem)
    body.insert(insert_at, placeholder)
    return True


def tag_doc(src: Path, dst: Path, single_map: dict, whole_clause: set, schedule: set, start_anchor: str, end_anchor: str):
    with zipfile.ZipFile(src) as z:
        doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    body = root.find(NSW + "body")

    sched_ok = replace_schedule_block(body, start_anchor, end_anchor)

    tagged = 0
    skipped_clause = 0
    skipped_schedule = 0
    skipped_unknown_markers: list[str] = []
    skipped_no_marker = 0

    def close_group(grp, pending: str | None) -> str | None:
        nonlocal tagged, skipped_clause, skipped_schedule, skipped_no_marker
        text = "".join(run_text(r) for r in grp).strip()
        marker, rest = parse_leading_marker(text)
        # Marker-only highlighted group → blank it, hand the marker forward.
        if marker and not rest:
            set_group_text(grp, "")
            return marker
        effective = marker or pending
        if not effective:
            skipped_no_marker += 1
            return None
        if effective in single_map:
            set_group_text(grp, single_map[effective])
            tagged += 1
        elif effective in whole_clause:
            skipped_clause += 1
        elif effective in schedule:
            skipped_schedule += 1
        else:
            skipped_unknown_markers.append(effective)
        return None

    known = set(single_map) | whole_clause | schedule

    def latest_known_marker(buf: str, fallback: str | None) -> str | None:
        last = None
        for mk, _ in scan_markers(buf):
            if mk in known:
                last = mk
        return last or fallback

    for p in body.findall(NSW + "p"):
        pending: str | None = None
        in_group = False
        group: list = []
        nonhl_buffer = ""
        for r in p.findall(NSW + "r"):
            if is_highlighted(r):
                if not in_group:
                    # Resolve a marker from the non-hl text leading up to this group.
                    pending = latest_known_marker(nonhl_buffer, pending)
                    nonhl_buffer = ""
                    in_group = True
                    group = []
                group.append(r)
            else:
                if in_group:
                    pending = close_group(group, pending)
                    in_group = False
                    group = []
                nonhl_buffer += run_text(r)
        if in_group:
            pending = latest_known_marker(nonhl_buffer, pending)
            close_group(group, pending)

    out_xml = ET.tostring(root, xml_declaration=True, encoding="UTF-8")
    # Repackage zip with new document.xml
    with zipfile.ZipFile(src) as zin:
        names = zin.namelist()
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            for n in names:
                if n == "word/document.xml":
                    zout.writestr(n, out_xml)
                else:
                    zout.writestr(n, zin.read(n))

    print(f"  schedule replaced: {sched_ok}")
    print(f"  tagged groups: {tagged}")
    print(f"  skipped (whole-clause): {skipped_clause}")
    print(f"  skipped (schedule-leftover): {skipped_schedule}")
    print(f"  skipped (no marker): {skipped_no_marker}")
    if skipped_unknown_markers:
        from collections import Counter
        c = Counter(skipped_unknown_markers)
        print(f"  unknown markers: {dict(c)}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    print("RESIDENTIAL:")
    tag_doc(
        SRC / "Lease Agreement - sample - 25.05.2026.docx",
        OUT / "residential.docx",
        RES_MAP, WHOLE_CLAUSE_RES, SCHEDULE_RES,
        "to be paid in the following manner",
        "For purposes of calculating Stamp Duty",
    )
    print("\nCOMMERCIAL:")
    tag_doc(
        SRC / "Draft Lease - Lucky Seven Building -R.A.De Mel Mawatha (1).docx",
        OUT / "commercial.docx",
        COM_MAP, WHOLE_CLAUSE_COM, SCHEDULE_COM,
        "YIELDING AND PAYING therefor unto the Lessor the rental of",
        "THE LESSEE to the intent that the obligations",
    )
    print(f"\nWrote tagged templates to {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
