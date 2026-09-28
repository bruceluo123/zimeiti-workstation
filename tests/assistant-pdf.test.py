"""Regression fixtures are generated only in a temporary test directory."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from reportlab.pdfgen.canvas import Canvas

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="zmt-pdf-test-") as directory:
    fixture = Path(directory) / "two-pages.pdf"
    canvas = Canvas(str(fixture))
    canvas.drawString(72, 740, "A sourced example for knowledge reuse.")
    canvas.showPage()
    canvas.showPage()
    canvas.save()
    result = subprocess.run(
        [sys.executable, str(root / "scripts/assistant/extract-pdf.py"), str(fixture)],
        capture_output=True, text=True, check=True,
    )
    output = json.loads(result.stdout)
    assert output["pages"][0]["locator"] == "第 1 页"
    assert "sourced example" in output["pages"][0]["text"]
    assert output["emptyPages"] == [2]
    print("PASS: PDF text and original page locator; blank/scanned page warning")
