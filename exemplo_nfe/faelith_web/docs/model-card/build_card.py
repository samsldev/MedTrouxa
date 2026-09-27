"""
@fileoverview Renders the Echo and Horizon model card (EN, pt-BR, pt-PT) from Markdown to print-ready PDF.
@author Samuel S. L.
@version 1.1.0
@since 2026-09-26
@copyright (c) 2026 Samuel S. L. All rights reserved.
All information contained herein is, and remains, the property of
Samuel S. L. and its suppliers, if any.

The intellectual, technical, creative, and software concepts contained
herein are proprietary to Samuel S. L. and its suppliers and
are protected by copyright law, trade secret law, and other applicable
intellectual property laws in the Netherlands, the European Union, and
other foreign jurisdictions.

Where applicable, such rights may be registered, recorded, or protected
with the competent authorities of the Government of the Netherlands,
the European Union, and/or other relevant jurisdictions.

Dissemination of this information, reproduction of this material,
modification, distribution, disclosure, or commercial use is strictly
forbidden unless prior written permission is obtained from
Samuel S. L.

@commercialUse Commercial use permitted only with prior written permission from Samuel S. L.

<DETAILED_DESCRIPTION>:
- Converts the small Markdown subset used by card.*.md (headings, paragraphs, lists, tables, bold, italic, code)
- Cover page, table of contents, one top-level section per page, page numbers, system-card typography
- Optional --pairbench results JSON fills the PairBench rows (sections 2.2 and 5); other "{{PENDING}}"
  values render as "Pending" / "Pendente" so no number is ever invented
- Prints with headless Microsoft Edge or Google Chrome (--print-to-pdf)
- Optional --capabilities JSON (run_capabilities.py) fills section 3.1 cell by cell (only measured cells)
- Usage: python build_card.py [--pairbench .../pairbench_results.json] [--capabilities .../capabilities_results.json]
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
LANGS = {"en": ("en", "Pending", "Contents"), "pt-BR": ("pt-BR", "Pendente", "Sumário"), "pt-PT": ("pt-PT", "Pendente", "Índice")}
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]

# Order of the PairBench rows in section 2.2, matched to the runner's JSON.
PAIRBENCH_ROWS = [
    lambda m: m["humanevalcomm"]["communication_rate"],
    lambda m: m["humanevalcomm"]["good_question_rate"],
    lambda m: m["humanevalcomm"]["pass_at_1"],
    lambda m: m["humanevalcomm"]["test_pass_rate"],
    lambda m: m["control"]["over_asking_rate"],
    lambda m: m["control"]["pass_at_1"],
    lambda m: m["agentic"]["confirmation_rate"],
    lambda m: m["agentic"]["safe_execution_rate"],
]

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono&display=swap');
@page { size: A4; margin: 26mm 22mm 24mm; @bottom-right { content: counter(page); font: 10pt Lora, serif; color: #555; } }
@page cover { margin: 0; @bottom-right { content: none; } }
* { box-sizing: border-box; }
body { font-family: Lora, Georgia, serif; font-size: 11pt; line-height: 1.55; color: #141413; margin: 0; }
.cover { page: cover; height: 297mm; padding: 42mm 26mm 22mm; display: flex; flex-direction: column; break-after: page; }
.wordmark { font: 700 22pt Inter, sans-serif; letter-spacing: 0.08em; display: flex; align-items: center; gap: 10px; }
.mark { width: 18px; height: 18px; background: #d9434f; transform: rotate(45deg); border-radius: 3px; }
.cover h1 { font: 400 50pt/1.08 'Instrument Serif', Georgia, serif; margin: auto 0 0; letter-spacing: -0.01em; }
.cover .meta { margin-top: 18mm; font-size: 13pt; }
.cover .rule { border-top: 1px solid #999; margin: 22mm 0 6mm; }
.cover .site { font: 600 10pt Inter, sans-serif; }
.toc { break-after: page; }
.toc h2 { font: 600 20pt Inter, sans-serif; margin: 0 0 8mm; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 1.2mm 0; }
.toc .l1 { font-weight: 600; margin-top: 3mm; }
.toc .l2 { padding-left: 7mm; }
.toc .l3 { padding-left: 14mm; }
h1 { font: 600 20pt Inter, sans-serif; margin: 0 0 6mm; }
section.top { break-before: page; }
h2 { font: 600 15pt Inter, sans-serif; margin: 9mm 0 3mm; }
h3 { font: 500 12.5pt Inter, sans-serif; color: #5f5f5b; margin: 7mm 0 2mm; }
h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
p { margin: 0 0 3.2mm; text-align: left; }
ul, ol.body { margin: 0 0 3.5mm; padding-left: 6mm; }
li { margin: 0 0 1.4mm; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 9.6pt; break-inside: avoid; }
th, td { border-bottom: 1px solid #d6d4cc; padding: 2mm 2.4mm; text-align: left; vertical-align: top; }
th { font: 600 9pt Inter, sans-serif; background: #f3f1ea; }
td.n, th.n { text-align: right; }
code { font: 9.4pt 'JetBrains Mono', monospace; background: #f3f1ea; padding: 0 1mm; border-radius: 2px; }
.pending { color: #8a8780; font-style: italic; }
"""


def inline(text: str, pending: str) -> str:
    """Escapes text and applies bold, italic, code, and the pending marker."""
    out = html.escape(text, quote=False)
    out = out.replace("{{PENDING}}", f'<span class="pending">{pending}</span>')
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![\w*])\*([^*]+)\*(?!\w)", r"<em>\1</em>", out)
    return out


# Section 3.1 rows (benchmark keys) and columns (catalog ids), in table order.
CAPABILITY_ROWS = ["swebench_verified", "terminal_bench", "livecodebench", "aider_polyglot", "humaneval", "long_context"]
CAPABILITY_COLUMNS = ["echo", "echo1m", "horizon", "horizon1m"]


def fill_capabilities(markdown: str, results: dict) -> str:
    """Replaces measured cells of the section 3.1 table; unmeasured cells stay pending."""
    scores = results.get("scores", {})
    head, sep, tail = markdown.partition("\n## 3.1")
    section, sep2, rest = tail.partition("\n## 3.2")
    rows = [line for line in section.split("\n") if line.startswith("|") and "{{PENDING}}" in line]
    for key, line in zip(CAPABILITY_ROWS, rows):
        cells = line.split("|")
        pending = [i for i, cell in enumerate(cells) if cell.strip() == "{{PENDING}}"]
        for column, index in zip(CAPABILITY_COLUMNS, pending):
            value = scores.get(key, {}).get(column)
            if value is not None:
                cells[index] = f" {value}% "
        section = section.replace(line, "|".join(cells), 1)
    return head + sep + section + sep2 + rest


def fill_pairbench(markdown: str, results: dict) -> str:
    """Replaces the PENDING cells of the PairBench tables with measured values (Echo, Horizon)."""
    models = results.get("models", {})
    if not {"echo", "horizon"} <= set(models):
        raise SystemExit("pairbench results must contain echo and horizon")
    values = [f"{get(models[name])}%" for get in PAIRBENCH_ROWS for name in ("echo", "horizon")]
    head, sep, tail = markdown.partition("\n## 2.2")
    section, sep2, rest = tail.partition("\n# 3")
    for value in values:
        section = section.replace("{{PENDING}}", value, 1)
    agentic = [f"{models[n]['agentic']['confirmation_rate']}%" for n in ("echo", "horizon")]
    part5, sep3, after5 = rest.partition("\n# 6")
    lines = part5.split("\n")
    for i, line in enumerate(lines):
        if "PairBench" in line and "{{PENDING}}" in line:
            for value in agentic:
                line = line.replace("{{PENDING}}", value, 1)
            lines[i] = line
    return head + sep + section + sep2 + "\n".join(lines) + sep3 + after5


def render(markdown: str, lang: str) -> str:
    """Converts one card to a full HTML document."""
    html_lang, pending, contents = LANGS[lang]
    markdown = re.sub(r"<!--.*?-->", "", markdown, flags=re.S)
    meta = dict(re.findall(r"^@(\w+) (.+)$", markdown, re.M))
    lines = [line for line in markdown.split("\n") if not line.startswith("@")]
    body, toc, i, open_section = [], [], 0, False
    while i < len(lines):
        line = lines[i]
        heading = re.match(r"^(#{1,3}) (.+)$", line)
        if heading:
            level, text = len(heading.group(1)), heading.group(2)
            anchor = f"s{len(toc)}"
            toc.append((level, text, anchor))
            if level == 1:
                if open_section:
                    body.append("</section>")
                body.append('<section class="top">')
                open_section = True
            body.append(f'<h{level} id="{anchor}">{inline(text, pending)}</h{level}>')
            i += 1
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            head, *data = rows
            # Right-align columns whose cells are all numbers, percentages, token counts, or pending values.
            numeric = [all(re.fullmatch(r"(\{\{PENDING\}\}|[\d.,% ]+(tokens)?)", row[c]) for row in data if c < len(row)) for c in range(len(head))]
            cls = lambda c: ' class="n"' if c < len(numeric) and numeric[c] else ""  # noqa: E731
            body.append("<table><thead><tr>" + "".join(f"<th{cls(c)}>{inline(v, pending)}</th>" for c, v in enumerate(head)) + "</tr></thead><tbody>")
            body.extend("<tr>" + "".join(f"<td{cls(c)}>{inline(v, pending)}</td>" for c, v in enumerate(row)) + "</tr>" for row in data)
            body.append("</tbody></table>")
        elif re.match(r"^(- |\d+\. )", line):
            ordered = bool(re.match(r"^\d+\. ", line))
            items = []
            while i < len(lines) and re.match(r"^(- |\d+\. )", lines[i]):
                items.append(re.sub(r"^(- |\d+\. )", "", lines[i]))
                i += 1
            tag = "ol" if ordered else "ul"
            body.append(f'<{tag} class="body">' + "".join(f"<li>{inline(item, pending)}</li>" for item in items) + f"</{tag}>")
        elif line.strip():
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||- |\d+\. )", lines[i]):
                paragraph.append(lines[i])
                i += 1
            body.append(f"<p>{inline(' '.join(paragraph), pending)}</p>")
        else:
            i += 1
    if open_section:
        body.append("</section>")
    toc_html = "".join(f'<li class="l{level}"><a href="#{anchor}" style="color:inherit;text-decoration:none">{inline(text, pending)}</a></li>' for level, text, anchor in toc)
    title = meta.get("title", "Model Card")
    return f"""<!doctype html><html lang="{html_lang}"><head><meta charset="utf-8"><title>{html.escape(title)}</title><style>{CSS}</style></head><body>
<div class="cover"><div class="wordmark"><span class="mark"></span>FAELITH</div>
<h1>{html.escape(title).replace(': ', ':<br>')}</h1>
<div class="meta">{html.escape(meta.get('date', ''))}<br>{html.escape(meta.get('version', ''))}</div>
<div class="rule"></div><div class="site">faelithindustries.com</div></div>
<nav class="toc"><h2>{contents}</h2><ol>{toc_html}</ol></nav>
{''.join(body)}
</body></html>"""


def print_pdf(html_path: Path, pdf_path: Path) -> None:
    """Prints an HTML file to PDF with the first available Chromium browser."""
    browser = next((b for b in BROWSERS if Path(b).exists()), None)
    if browser is None:
        raise SystemExit("no Edge or Chrome found for PDF printing")
    subprocess.run(
        [browser, "--headless", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000", f"--print-to-pdf={pdf_path}", html_path.as_uri()],
        check=True,
        capture_output=True,
    )


def main() -> None:
    """Builds the three PDFs (and their HTML) next to this script."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--pairbench", help="pairbench_results.json from run_pairbench.py")
    parser.add_argument("--capabilities", help="capabilities_results.json from run_capabilities.py")
    args = parser.parse_args()
    results = json.loads(Path(args.pairbench).read_text(encoding="utf-8")) if args.pairbench else None
    capabilities = json.loads(Path(args.capabilities).read_text(encoding="utf-8")) if args.capabilities else None
    out = HERE / "dist"
    out.mkdir(exist_ok=True)
    for lang in LANGS:
        markdown = (HERE / f"card.{lang}.md").read_text(encoding="utf-8")
        if results:
            markdown = fill_pairbench(markdown, results)
        if capabilities:
            markdown = fill_capabilities(markdown, capabilities)
        page = out / f"Faelith_Model_Card_Echo_Horizon_{lang}.html"
        page.write_text(render(markdown, lang), encoding="utf-8")
        pdf = out / f"Faelith_Model_Card_Echo_Horizon_{lang}.pdf"
        print_pdf(page, pdf)
        print(f"{pdf.name}: {pdf.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
