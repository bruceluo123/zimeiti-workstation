"""Local text-only PDF extraction. Emits page locators; never executes embedded content."""
import json
import sys
from pypdf import PdfReader

try:
    reader = PdfReader(sys.argv[1])
    if reader.is_encrypted:
        raise ValueError("PDF 已加密，请先解密后上传")
    if len(reader.pages) > 1500:
        raise ValueError("PDF 超过 1500 页，请分册导入")
    pages = []
    total = 0
    empty = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        total += len(text)
        if total > 2000000:
            raise ValueError("PDF 文字超过 200 万字，请分册导入")
        if text.strip():
            pages.append({"locator": f"第 {index + 1} 页", "text": text})
        else:
            empty.append(index + 1)
    if not pages:
        raise ValueError("PDF 没有可读取的文字，扫描件请先 OCR")
    print(json.dumps({"pages": pages, "emptyPages": empty}, ensure_ascii=True))
except Exception as exc:
    print(json.dumps({"error": str(exc)[:200]}, ensure_ascii=True))
    sys.exit(1)
