"""
QR Code service — generate unique QR codes for product batches.
Uses uuid4 for non-sequential, non-predictable hashes.
"""

import uuid
import io
import base64

import qrcode
from qrcode.image.styledpil import StyledPilImage


class QRService:
    """Generate and manage QR codes for product traceability."""

    BASE_URL = "https://yawgriva.codewithdanu.my.id/trace"

    @staticmethod
    def generate_hash() -> str:
        """Generate a unique, non-sequential QR hash using uuid4."""
        return uuid.uuid4().hex

    @classmethod
    def generate_qr_image(cls, qr_hash: str) -> str:
        """
        Generate a QR code image as base64-encoded PNG.
        The QR encodes the full trace URL for easy scanning.
        """
        trace_url = f"{cls.BASE_URL}/{qr_hash}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(trace_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#1F6B3C", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    @classmethod
    def get_trace_url(cls, qr_hash: str) -> str:
        """Get the full trace URL for a QR hash."""
        return f"{cls.BASE_URL}/{qr_hash}"
