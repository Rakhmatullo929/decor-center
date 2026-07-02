"""Instruction text extraction.

Phase 4 will add real PDF/DOCX parsing; for now plain-text files are
decoded best-effort and binary formats yield an empty string (the mock
generator does not depend on real content).
"""


def extract_instruction_text(file_field) -> str:
    file_field.open("rb")
    data = file_field.read()
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return ""
