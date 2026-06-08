"""
Vision Service — Feature 3: Foto Kondisi Produk + AI Visual Analysis.

Uses Gemini Vision (gemini-2.5-flash) to analyze product photos uploaded
by distributors at checkpoints.

Constraints per PRD:
- Max 3 photos per batch
- Max 5MB per photo, compressed to 800px before sending to Gemini
- Upload is optional, never blocks checkpoint flow
- Photos stored in object storage (URL stored in DB, not bytes)
"""

import io
import json
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

VISION_PROMPT = """
Kamu adalah sistem inspeksi kualitas produk hortikultura.
Analisis foto ini dan kembalikan HANYA JSON berikut, tanpa teks lain:
{
  "condition": "excellent|good|fair|poor|unknown",
  "condition_id": "Sangat Baik|Baik|Cukup|Perlu Perhatian|Tidak Diketahui",
  "issues": [],
  "confidence": 0.0,
  "summary": "satu kalimat dalam Bahasa Indonesia"
}

Panduan kondisi:
- excellent: produk terlihat sangat segar, tidak ada kerusakan visible
- good: segar, mungkin ada kerusakan minor yang tidak mempengaruhi nilai
- fair: ada tanda-tanda penurunan kualitas yang perlu diperhatikan
- poor: kerusakan signifikan, nilai jual kemungkinan berkurang
- unknown: gambar tidak jelas atau bukan foto produk pertanian

Jika tidak yakin, pilih kondisi yang lebih rendah — lebih baik konservatif.
Jangan mengarang isu yang tidak terlihat jelas di foto.
"""

# Use gemini-1.5-flash for vision — separate quota pool from gemini-2.5-flash
VISION_MODEL = "gemini-1.5-flash"

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
MAX_IMAGE_DIMENSION_PX = 800


@dataclass
class VisualAnalysisResult:
    condition: str       # excellent | good | fair | poor | unknown
    condition_id: str    # Indonesian label
    issues: list[str]    # list of detected issues
    confidence: float    # 0.0 – 1.0
    summary: str         # one sentence description

    @property
    def condition_color(self) -> str:
        return {
            "excellent": "green",
            "good": "blue",
            "fair": "orange",
            "poor": "red",
            "unknown": "gray",
        }.get(self.condition, "gray")


def compress_image(image_bytes: bytes, max_dimension: int = MAX_IMAGE_DIMENSION_PX) -> bytes:
    """
    Compress image to max_dimension × max_dimension (JPEG, q=85).
    Returns compressed bytes. Falls back to original if PIL unavailable.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

        # Convert to RGB if necessary (e.g. PNG with alpha)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except ImportError:
        logger.warning("PIL not available — skipping image compression")
        return image_bytes
    except Exception as e:
        logger.error(f"Image compression failed: {e}")
        return image_bytes


async def analyze_product_photo(
    image_bytes: bytes,
    commodity: str,
) -> VisualAnalysisResult:
    """
    Analyze a product photo using Gemini Vision.

    Args:
        image_bytes: raw image bytes (max 5MB)
        commodity: commodity name for context

    Returns:
        VisualAnalysisResult with condition assessment
    """
    _fallback = VisualAnalysisResult(
        condition="unknown",
        condition_id="Tidak Diketahui",
        issues=[],
        confidence=0.0,
        summary="Analisis visual tidak tersedia untuk foto ini.",
    )
    _rate_limit_fallback = VisualAnalysisResult(
        condition="unknown",
        condition_id="Tidak Diketahui",
        issues=[],
        confidence=0.0,
        summary="Analisis AI sedang sibuk (batas kuota tercapai). Silakan coba lagi beberapa menit.",
    )

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        logger.warning(f"Image too large ({len(image_bytes)} bytes), rejecting")
        return _fallback

    try:
        import google.generativeai as genai
        from core.config import settings

        # Configure API key explicitly
        genai.configure(api_key=settings.GEMINI_API_KEY)

        # Compress before sending
        compressed = compress_image(image_bytes)

        # Use gemini-1.5-flash — has a separate free-tier quota from gemini-2.5-flash
        model = genai.GenerativeModel(VISION_MODEL)
        prompt = VISION_PROMPT + f"\nKomoditas yang difoto: {commodity}"

        response = model.generate_content(
            [
                prompt,
                {"mime_type": "image/jpeg", "data": compressed},
            ],
            request_options={"timeout": 10.0}
        )

        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        data = json.loads(raw_text)
        return VisualAnalysisResult(
            condition=data.get("condition", "unknown"),
            condition_id=data.get("condition_id", "Tidak Diketahui"),
            issues=data.get("issues", []),
            confidence=float(data.get("confidence", 0.0)),
            summary=data.get("summary", "Analisis tidak tersedia."),
        )

    except Exception as e:
        err_str = str(e)
        logger.warning(f"Gemini Vision failed ({err_str}). Trying OpenAI fallback...")
        
        try:
            import base64
            from openai import AsyncOpenAI
            from core.config import settings

            if not settings.OPENAI_API_KEY:
                logger.error("OpenAI API key not configured for fallback.")
                if "429" in err_str or "quota" in err_str.lower() or "ResourceExhausted" in err_str:
                    return _rate_limit_fallback
                return _fallback

            compressed = compress_image(image_bytes)
            base64_image = base64.b64encode(compressed).decode("utf-8")

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            openai_prompt = VISION_PROMPT + f"\nKomoditas yang difoto: {commodity}"

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": openai_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300,
                response_format={"type": "json_object"},
                timeout=10.0
            )

            raw_text = response.choices[0].message.content.strip()
            data = json.loads(raw_text)
            logger.info("OpenAI fallback vision analysis completed successfully.")
            return VisualAnalysisResult(
                condition=data.get("condition", "unknown"),
                condition_id=data.get("condition_id", "Tidak Diketahui"),
                issues=data.get("issues", []),
                confidence=float(data.get("confidence", 0.0)),
                summary=data.get("summary", "Analisis tidak tersedia."),
            )
        except Exception as openai_err:
            logger.error(f"OpenAI fallback vision analysis also failed: {openai_err}")
            if "429" in err_str or "quota" in err_str.lower() or "ResourceExhausted" in err_str:
                return _rate_limit_fallback
            return _fallback


async def upload_photo_to_storage(
    image_bytes: bytes,
    filename: str,
    supabase_client,
    bucket: str = "checkpoint-photos",
) -> Optional[str]:
    """
    Upload compressed photo to Supabase Storage.

    Returns:
        Public URL of the uploaded photo, or None on failure
    """
    try:
        compressed = compress_image(image_bytes)
        response = supabase_client.storage.from_(bucket).upload(
            path=filename,
            file=compressed,
            file_options={"content-type": "image/jpeg"},
        )
        if hasattr(response, "error") and response.error:
            logger.error(f"Supabase upload error: {response.error}")
            return None

        public_url = supabase_client.storage.from_(bucket).get_public_url(filename)
        return public_url
    except Exception as e:
        logger.error(f"Photo upload failed: {e}")
        return None
