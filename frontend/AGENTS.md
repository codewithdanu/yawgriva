<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md
## Dokumentasi Teknis AI Agent Layer — Yawgriva
**Service:** `yawgriva-backend/agents/`
**Framework:** LangChain 0.3+ dengan Gemini 2.5 Flash (primer) + GPT-4o-mini (fallback)
**Dibaca oleh:** Developer yang mengerjakan `agents/`, atau siapapun yang perlu memahami cara agent berpikir dan bekerja.

---

## Mengapa Dokumen Ini Ada

AI Agent bukan magic. Ia adalah kode yang berinteraksi dengan LLM melalui tools, system prompt, dan memory. Dokumen ini menjelaskan dengan tepat bagaimana setiap agent dirancang, mengapa ia dibuat dengan cara itu, dan apa yang boleh serta tidak boleh dilakukan ketika memodifikasinya.

Satu perubahan kecil di system prompt bisa mengubah perilaku agent secara tidak terduga di production. Setiap perubahan system prompt wajib disertai update di dokumen ini dan minimal satu test case baru.

---

## Arsitektur Umum

Yawgriva memiliki empat agent yang bekerja secara independen, dikoordinasikan oleh satu `Orchestrator`. Setiap agent adalah instance LangChain `AgentExecutor` dengan tools dan system prompt berbeda. Mereka tidak saling berkomunikasi langsung — semua koordinasi di level Python, bukan di level LLM.

```
                    ┌──────────────────┐
  Request masuk →   │   Orchestrator   │
                    └────────┬─────────┘
                             │ intent classification
              ┌──────────────┼──────────────┬──────────────┐
              ▼              ▼              ▼              ▼
        PriceAgent   LogisticsAgent   AnomalyAgent   VisualAgent
        (harga &     (rute &          (monitor       (foto kondisi
         prediksi)    freshness)       distribusi)    produk)
```

### Fallback Provider

Semua agent menggunakan pola yang sama untuk provider LLM:

```python
# core/llm_factory.py
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

def get_llm(max_tokens: int = 500, temperature: float = 0.1):
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        max_output_tokens=max_tokens,
        temperature=temperature,
    )

def get_fallback_llm(max_tokens: int = 500, temperature: float = 0.1):
    return ChatOpenAI(
        model="gpt-4o-mini",
        max_tokens=max_tokens,
        temperature=temperature,
    )
```

### Caching Wajib

Setiap agent harus mengimplementasikan cache Redis sebelum memanggil LLM. Format cache key yang konsisten:

```python
cache_key = f"{agent_name}:{hashlib.md5(input_string.encode()).hexdigest()}"
# Contoh: "price_agent:a3f8c2d1e4b9..."
TTL = 900  # 15 menit untuk semua agent
```

---

## Agent 1: Price Intelligence Agent

### Tujuan

Menjawab satu pertanyaan: *"Kapan waktu terbaik untuk menjual komoditas ini, dan berapa harga yang bisa diharapkan?"*

Mengkombinasikan data harga real-time dari Panel Harga Kementan dan Info Pangan Jakarta, prediksi time-series, data cuaca BMKG, dan data Community Price Report dari petani lain.

### Tools

```python
# agents/tools/price_tools.py

@tool
def fetch_panel_harga_kementan(commodity: str, region: str) -> dict:
    """
    Ambil harga komoditas terkini dari database Panel Harga Kementan.
    Cache 30 menit di Redis sebelum memanggil API lagi.

    Args:
        commodity: nama komoditas lowercase, underscore (contoh: 'cabai_merah')
        region: kode wilayah (contoh: 'jawa_tengah', 'jawa_barat')
    Returns:
        {market_name: {price_per_kg: float, recorded_at: str}}
    """
    ...

@tool
def fetch_info_pangan_jakarta(commodity: str) -> dict:
    """
    Ambil harga komoditas dari Info Pangan Jakarta sebagai sumber sekunder.
    Digunakan sebagai cross-check atau fallback jika Panel Harga tidak tersedia.
    """
    ...

@tool
def get_price_prediction(commodity: str, region: str, days_ahead: int = 7) -> dict:
    """
    Ambil prediksi harga dari model time-series yang sudah di-train.
    Model di-retrain setiap Minggu menggunakan data historis 6 bulan terakhir.

    Args:
        days_ahead: berapa hari ke depan (1–14, lebih dari 14 tidak reliable)
    Returns:
        {predicted_prices: list[float], confidence_interval: list[tuple],
         model_accuracy_mape: float}
    """
    ...

@tool
def get_community_price(commodity: str, region: str) -> dict:
    """
    Ambil agregat harga lapangan yang dilaporkan petani hari ini.
    Hanya tersedia jika ada minimal 3 laporan untuk komoditas + region ini.

    Returns:
        {community_price: float, report_count: int, gap_vs_official: float}
        atau None jika data tidak cukup.
    """
    ...

@tool
def get_weather_impact(commodity: str, region: str) -> str:
    """
    Analisis apakah kondisi cuaca 7 hari ke depan berpotensi mempengaruhi
    pasokan komoditas di region ini. Berguna untuk kontekstualisasi prediksi.

    Returns:
        String deskripsi dampak, contoh: "Potensi hujan lebat di sentra
        produksi Brebes dalam 3 hari ke depan. Pasokan cabai rawit
        berpotensi turun 15–20%."
    """
    ...
```

### System Prompt

```python
PRICE_AGENT_SYSTEM_PROMPT = """
Kamu adalah Price Intelligence Agent untuk platform Yawgriva.
Tugasmu adalah membantu petani hortikultura Indonesia membuat keputusan
jual yang lebih baik berdasarkan data harga pasar dan prediksi.

PERAN DAN BATASAN:
- Berbicara langsung dengan petani dalam Bahasa Indonesia yang lugas.
- Jangan gunakan istilah statistik tanpa menjelaskannya dengan bahasa sederhana.
- Selalu sebut sumber data. Jika dari Panel Harga Kementan, katakan demikian.
  Jika prediksi, katakan "prediksi sistem" dan sertakan disclaimer bisa meleset.
- Jika data Community Price menunjukkan harga lapangan jauh berbeda dari
  data resmi, prioritaskan data lapangan dan jelaskan perbedaannya.
- Jika tidak punya data cukup untuk rekomendasi yang andal, katakan jujur.
- Kamu TIDAK bisa membantu di luar domain harga dan keputusan jual.

FORMAT RESPONS (maksimal 5 kalimat):
1. Harga saat ini di pasar terdekat.
2. Prediksi arah harga (naik/turun/stabil) + alasan singkat.
3. Rekomendasi aksi konkret: jual sekarang, tahan N hari, atau pasar alternatif.
4. Jika ada data Community Price yang relevan, sebutkan.
5. (Opsional) Catatan cuaca jika sangat relevan.

CONTOH RESPONS YANG BAIK:
"Harga tomat di Pasar Induk Kramat Jati hari ini Rp 4.200/kg.
Prediksi sistem menunjukkan harga naik ke Rp 4.600–4.800 dalam 4 hari,
karena pasokan dari Jawa Tengah berkurang akibat cuaca. Kalau stok
masih segar, pertimbangkan tahan 3–4 hari. 5 petani di wilayahmu
melaporkan harga lapangan Rp 3.800 dari tengkulak — jauh di bawah pasar,
jadi pertimbangkan jual langsung ke pasar atau melalui Yawgriva."

CONTOH RESPONS YANG BURUK:
"Berdasarkan analisis time-series dengan confidence interval 85%,
harga komoditas diproyeksikan mengalami apresiasi nilai sebesar 12.3%
dalam rentang temporal 96 jam ke depan." — terlalu teknis, tidak membantu.
"""
```

---

## Agent 2: Logistics Optimization Agent

### Tujuan

Menjawab: *"Rute mana yang terbaik hari ini untuk batch produk ini, mempertimbangkan kondisi jalan, cuaca, dan umur simpan?"*

Agent ini dipanggil secara programatik dari route planner distributor, bukan via freeform chat.

### Tools

```python
# agents/tools/maps_tools.py

@tool
def calculate_routes(
    origin_coords: tuple[float, float],
    destination_coords: tuple[float, float],
    waypoints: list[tuple[float, float]] = [],
) -> list[dict]:
    """
    Hitung 2–3 opsi rute via Google Maps Directions API.
    Minta alternatif rute dengan alternatives=true.
    Sertakan real-time traffic.

    Returns:
        List of routes, masing-masing: {
            total_distance_km, estimated_duration_minutes,
            traffic_condition ('light'/'moderate'/'heavy'),
            steps: list[str], polyline: str
        }
    """
    ...

@tool
def get_freshness_window(commodity: str, avg_temp_celsius: float) -> dict:
    """
    Hitung berapa jam produk masih layak jual berdasarkan komoditas dan suhu.
    Data dari COMMODITY_SHELF_LIFE_HOURS di freshness_service.py.

    Returns:
        {safe_hours: int, risk_after_hours: int, recommendation: str}
    """
    ...

@tool
def find_cold_storage_near_route(route_polyline: str) -> list[dict]:
    """
    Cari fasilitas cold storage dalam radius 5km dari rute.
    Berguna untuk komoditas yang butuh singgah pendinginan.

    Returns:
        List of {name, address, lat, lng, contact}
    """
    ...

@tool
def calculate_carbon_for_route(
    distance_km: float,
    vehicle_type: str,
    quantity_kg: float,
) -> dict:
    """
    Hitung estimasi CO₂ untuk rute ini menggunakan carbon_service.py.
    Selalu sertakan ini dalam output rekomendasi rute.

    Returns:
        CarbonResult dict
    """
    ...
```

### System Prompt

```python
LOGISTICS_AGENT_SYSTEM_PROMPT = """
Kamu adalah Logistics Optimization Agent untuk platform Yawgriva.
Input yang kamu terima adalah JSON terstruktur. Output wajib JSON.

ATURAN KETAT:
- Jangan tambahkan teks naratif di luar field JSON yang diminta.
- Jika tidak ada rute yang aman (semua melebihi freshness window),
  rekomendasikan tunda pengiriman dan jelaskan alasannya.
- Selalu sertakan carbon_footprint dalam output.

FORMAT OUTPUT WAJIB:
{
  "recommended_route_index": 0,
  "reason": "string — mengapa rute ini dipilih (maks 2 kalimat)",
  "freshness_assessment": "string — estimasi kondisi produk saat tiba",
  "estimated_freshness_score_on_arrival": 0.0-100.0,
  "carbon_footprint": {
    "actual_kg_co2": 0.0,
    "saving_kg_co2": 0.0,
    "saving_percent": 0.0
  },
  "cold_storage_recommendation": null or "string",
  "alternatives": [
    {"route_index": 1, "reason": "string"}
  ]
}
"""
```

### Scoring Weights

```python
ROUTE_SCORING_WEIGHTS = {
    "freshness_risk": 0.45,   # tertinggi — produk rusak = kerugian total
    "duration_minutes": 0.35, # kedua
    "carbon_footprint": 0.10, # mendukung tema sustainability
    "distance_km": 0.10,      # proxy biaya BBM
}
```

---

## Agent 3: Anomaly Detection Agent

### Tujuan

Memantau seluruh batch aktif dan mendeteksi pola tidak normal secara otomatis. Berjalan via Celery worker setiap 30 menit dan event-triggered setiap kali checkpoint baru ditambahkan.

### Desain Penting: Logika Deteksi Tidak Menggunakan LLM

Logika deteksi anomali diimplementasikan sebagai kode Python deterministik, bukan LLM call. LLM hanya digunakan untuk satu hal: menghasilkan teks pesan alert yang human-friendly dari data anomali yang terstruktur.

Alasan: latensi rendah, biaya minimal, dan hasil yang 100% predictable.

```python
# agents/anomaly_agent.py

class AnomalyDetectionAgent:

    STALE_THRESHOLD_HOURS = {
        "kangkung":    8,
        "bayam":       8,
        "tomat":       14,
        "cabai_merah": 24,
        "cabai_rawit": 20,
        "bawang_merah": 48,
        "bawang_putih": 72,
        "default":     18,
    }

    def scan_batch(self, batch: BatchWithCheckpoints) -> list[Anomaly]:
        anomalies = []

        # Rule 1: Stale batch
        hours_since_last = self._hours_since_last_checkpoint(batch)
        threshold = self.STALE_THRESHOLD_HOURS.get(
            batch.commodity, self.STALE_THRESHOLD_HOURS["default"]
        )
        if hours_since_last > threshold:
            anomalies.append(Anomaly(
                type="STALE_BATCH",
                severity="high" if hours_since_last > threshold * 1.5 else "medium",
                data={"hours_elapsed": hours_since_last, "threshold": threshold}
            ))

        # Rule 2: Teleportasi — dua checkpoint berurutan > 300 km dalam < 2 jam
        if self._detect_teleportation(batch.checkpoints):
            anomalies.append(Anomaly(
                type="SUSPICIOUS_MOVEMENT",
                severity="high",
                data={}
            ))

        # Rule 3: Freshness score drop drastis (turun > 20 poin dalam satu interval)
        if batch.freshness_score is not None and batch.freshness_score < 40:
            anomalies.append(Anomaly(
                type="LOW_FRESHNESS",
                severity="high" if batch.freshness_score < 25 else "medium",
                data={"score": batch.freshness_score}
            ))

        # Rule 4: Suhu di luar batas aman (jika ada data suhu)
        if self._detect_temp_breach(batch):
            anomalies.append(Anomaly(
                type="TEMPERATURE_BREACH",
                severity="medium",
                data={}
            ))

        return anomalies

    async def generate_alert_message(
        self,
        anomaly: Anomaly,
        context: BatchContext,
    ) -> str:
        """
        LLM call minimal — hanya untuk teks human-friendly.
        max_tokens dibatasi ketat di 120.
        """
        prompt = f"""
        Tulis pesan alert (maks 2 kalimat) dalam Bahasa Indonesia untuk
        dikirim ke petani dan distributor tentang kondisi ini:

        Jenis masalah: {anomaly.type}
        Produk: {context.commodity} ({context.quantity_kg} kg)
        Detail: {anomaly.data}
        Terakhir update: {context.hours_since_update:.1f} jam lalu
        Lokasi terakhir: {context.last_location}

        Pesan harus: langsung ke poin, tidak menakut-nakuti, sertakan satu saran aksi.
        """
        response = await llm.ainvoke(prompt)
        return response.content
```

---

## Agent 4: Visual Analysis Agent (Baru)

### Tujuan

Menganalisis foto kondisi produk yang diupload distributor saat menambahkan checkpoint. Menggunakan Gemini Vision (multimodal) untuk mengestimasi kondisi fisik produk.

### Catatan Penting

Agent ini tidak menggunakan LangChain AgentExecutor — ia adalah direct API call ke Gemini Vision karena tidak membutuhkan tool calling, hanya satu inference dari satu gambar.

```python
# agents/visual_agent.py
import google.generativeai as genai
from PIL import Image
import io, json

VISUAL_ANALYSIS_PROMPT = """
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

class VisualAnalysisAgent:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    async def analyze(
        self,
        image_bytes: bytes,
        commodity: str,
    ) -> VisualAnalysisResult:
        # Compress sebelum kirim ke API
        image = Image.open(io.BytesIO(image_bytes))
        image.thumbnail((800, 800), Image.LANCZOS)
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=85)
        compressed_bytes = buf.getvalue()

        prompt = VISUAL_ANALYSIS_PROMPT + f"\nKomoditas yang difoto: {commodity}"

        response = self.model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": compressed_bytes}
        ])

        try:
            data = json.loads(response.text.strip())
        except (json.JSONDecodeError, AttributeError):
            data = {
                "condition": "unknown",
                "condition_id": "Tidak Diketahui",
                "issues": [],
                "confidence": 0.0,
                "summary": "Analisis visual tidak tersedia untuk foto ini."
            }

        return VisualAnalysisResult(**data)
```

---

## Orchestrator

```python
# agents/orchestrator.py

class YawgrivaOrchestrator:
    def __init__(self):
        self.price_agent     = PriceIntelligenceAgent()
        self.logistics_agent = LogisticsOptimizationAgent()
        self.anomaly_agent   = AnomalyDetectionAgent()
        self.visual_agent    = VisualAnalysisAgent()

    def _classify_intent(self, query: str) -> str:
        """
        Intent classification sederhana berbasis keyword.
        Tidak menggunakan LLM — terlalu mahal untuk klasifikasi dasar.
        """
        query_lower = query.lower()
        price_keywords = [
            "harga", "jual", "kapan", "prediksi", "pasar",
            "mahal", "murah", "untung", "rugi"
        ]
        logistics_keywords = [
            "rute", "kirim", "jalan", "distribusi", "pengiriman",
            "mana", "lewat", "ke", "tujuan"
        ]
        if any(k in query_lower for k in price_keywords):
            return "price"
        if any(k in query_lower for k in logistics_keywords):
            return "logistics"
        return "price"  # default ke price untuk query ambigu

    async def handle_chat(
        self,
        message: str,
        user_context: UserContext,
    ) -> AgentResponse:
        intent = self._classify_intent(message)
        if intent == "price":
            return await self.price_agent.run(message, user_context)
        elif intent == "logistics":
            return await self.logistics_agent.run(message, user_context)

    async def stream_chat(self, message: str, user_context: UserContext):
        """Generator untuk SSE streaming response."""
        intent = self._classify_intent(message)
        agent = self.price_agent if intent == "price" else self.logistics_agent
        async for chunk in agent.stream(message, user_context):
            yield chunk
```

---

## Panduan Testing Agent

### Kategori Test Wajib

**Happy path:** Semua data tersedia, agent menghasilkan output yang expected.

**Degraded data:** Satu atau lebih data source tidak tersedia. Agent harus merespons dengan graceful degradation, bukan crash.

**Edge cases:** Komoditas tidak dikenali, koordinat di luar Indonesia, foto bukan produk pertanian, query dalam bahasa daerah.

```bash
# Unit test semua agent (mock LLM calls)
pytest tests/test_agents/ -v -m "not integration"

# Integration test (memanggil API LLM sungguhan — jalankan manual)
pytest tests/test_agents/ -v -m "integration" --timeout=30

# Test visual agent khusus
pytest tests/test_agents/test_visual_agent.py -v -s
```

### Mock LLM untuk Unit Test

```python
# tests/conftest.py
from unittest.mock import AsyncMock
import pytest

@pytest.fixture
def mock_gemini(mocker):
    mock = AsyncMock()
    mock.ainvoke.return_value.content = "Harga tomat hari ini Rp 4.200/kg."
    mocker.patch("agents.price_agent.get_llm", return_value=mock)
    return mock
```

---

## Monitoring

Setiap agent call di-log ke tabel `agent_logs`. Di dashboard admin, tersedia tampilan real-time:

| Status | Definisi |
|--------|----------|
| `online` | Merespons dalam 10 detik terakhir |
| `degraded` | Merespons tapi dengan fallback provider |
| `offline` | Tidak merespons |

Jika `model_used` di log banyak menunjukkan `gpt-4o-mini` (fallback aktif), itu sinyal bahwa Gemini API sedang bermasalah dan perlu dicek.

---

## Aturan Modifikasi System Prompt

1. Buat branch baru sebelum mengubah system prompt apapun.
2. Jalankan test suite agent yang bersangkutan.
3. Test secara manual dengan minimal 10 query yang representatif.
4. Update bagian "System Prompt" di dokumen ini.
5. Tambahkan minimal satu test case baru yang mencakup perubahan.
6. Minta review dari satu anggota tim lain sebelum merge.

Melanggar aturan ini bisa mengakibatkan agent memberikan rekomendasi yang menyesatkan kepada petani — ini bukan sekadar bug teknis.
<!-- END:nextjs-agent-rules -->
