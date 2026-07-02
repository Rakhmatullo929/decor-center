"""Shared XLSX export helper (SRS §8.1.6)."""
from io import BytesIO

from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def xlsx_response(*, filename: str, sheet_title: str, headers: list[str], rows) -> HttpResponse:
    """Build an .xlsx HTTP response from a header row and an iterable of rows."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_title

    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for row in rows:
        sheet.append(row)

    # Reasonable default column widths based on header length.
    for index, header in enumerate(headers, start=1):
        sheet.column_dimensions[sheet.cell(row=1, column=index).column_letter].width = max(
            14, len(header) + 4
        )

    buffer = BytesIO()
    workbook.save(buffer)

    response = HttpResponse(buffer.getvalue(), content_type=XLSX_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
