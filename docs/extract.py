"""Extract text from .docx and .xlsx into readable .txt/.csv files.

Run: python3 docs/extract.py
Outputs go to docs/extracted/.
"""

import csv
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

DOCS = Path(__file__).resolve().parent
OUT = DOCS / "extracted"
OUT.mkdir(exist_ok=True)

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def docx_to_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    lines: list[str] = []
    for para in root.iter(f"{W_NS}p"):
        text = "".join(t.text or "" for t in para.iter(f"{W_NS}t"))
        lines.append(text)
    return "\n".join(lines)


def _col_to_idx(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n - 1


def xlsx_to_csvs(path: Path, out_dir: Path) -> list[Path]:
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in ss_root.iter(f"{S_NS}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{S_NS}t")))

        wb_root = ET.fromstring(z.read("xl/workbook.xml"))
        sheet_meta = []
        for s in wb_root.iter(f"{S_NS}sheet"):
            sheet_meta.append((s.get("name"), s.get(f"{{http://schemas.openxmlformats.org/officeDocument/2006/relationships}}id")))

        rels_root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rels = {r.get("Id"): r.get("Target") for r in rels_root}

        outputs = []
        for name, rid in sheet_meta:
            target = rels[rid]
            inner = f"xl/{target}" if not target.startswith("/") else target.lstrip("/")
            try:
                sheet_xml = z.read(inner)
            except KeyError:
                sheet_xml = z.read(f"xl/{target.lstrip('/')}")
            sroot = ET.fromstring(sheet_xml)
            rows = []
            max_cols = 0
            for row in sroot.iter(f"{S_NS}row"):
                cells = {}
                for c in row.iter(f"{S_NS}c"):
                    ref = c.get("r")
                    if not ref:
                        continue
                    idx = _col_to_idx(ref)
                    t = c.get("t")
                    v_el = c.find(f"{S_NS}v")
                    is_el = c.find(f"{S_NS}is")
                    if t == "s" and v_el is not None:
                        val = shared[int(v_el.text)] if v_el.text else ""
                    elif t == "inlineStr" and is_el is not None:
                        val = "".join(x.text or "" for x in is_el.iter(f"{S_NS}t"))
                    elif v_el is not None:
                        val = v_el.text or ""
                    else:
                        val = ""
                    cells[idx] = val
                    if idx + 1 > max_cols:
                        max_cols = idx + 1
                rows.append(cells)
            safe = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_") or "sheet"
            csv_path = out_dir / f"{path.stem}__{safe}.csv"
            with csv_path.open("w", newline="") as f:
                w = csv.writer(f)
                for r in rows:
                    w.writerow([r.get(i, "") for i in range(max_cols)])
            outputs.append(csv_path)
        return outputs


def main() -> int:
    written = []
    for p in sorted(DOCS.iterdir()):
        if p.is_dir() or p.name.startswith("."):
            continue
        suffix = p.suffix.lower()
        if suffix == ".docx":
            txt = docx_to_text(p)
            out = OUT / f"{p.stem}.txt"
            out.write_text(txt)
            written.append(out)
        elif suffix == ".xlsx":
            written.extend(xlsx_to_csvs(p, OUT))
        # .pdf is read natively by Claude; skip
    for w in written:
        print(w.relative_to(DOCS.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
