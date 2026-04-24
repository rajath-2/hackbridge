import tempfile
import os
import opendataloader_pdf


def extract_text(file_bytes: bytes) -> str:
    """
    Write bytes to a temp file, extract markdown via opendataloader_pdf,
    return plain text. opendataloader_pdf.convert() requires file paths
    and writes output to a directory — we read it back and clean up.
    """
    with tempfile.TemporaryDirectory() as out_dir:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            opendataloader_pdf.convert(
                input_path=[tmp_path],
                output_dir=out_dir,
                format="markdown",
            )
            # Output file is named after the input file with .md extension
            base = os.path.splitext(os.path.basename(tmp_path))[0]
            md_path = os.path.join(out_dir, f"{base}.md")
            if os.path.exists(md_path):
                with open(md_path, "r", encoding="utf-8") as f:
                    return f.read()
            return ""
        finally:
            os.unlink(tmp_path)
