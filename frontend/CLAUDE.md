@AGENTS.md
# CLAUDE.md
## Panduan untuk AI Coding Assistant — Yawgriva
**Dibaca oleh:** Claude, Cursor, GitHub Copilot, atau AI assistant apapun yang membantu development di repository ini.

---

## Konteks Proyek

Yawgriva adalah platform web AI-powered untuk rantai pasok hortikultura Indonesia. Dua service utama:

`yawgriva-frontend/` — Next.js 16.2 (LTS). Semua antarmuka pengguna. Berkomunikasi ke backend via Route Handlers (`app/api/[...path]/route.ts`) sebagai proxy — browser tidak pernah langsung ke backend.

`yawgriva-backend/` — Python FastAPI. Satu service untuk segalanya: REST API, autentikasi JWT, business logic, QR generation, AI Agent Layer, dan Celery workers. Tidak ada backend kedua.

**Bacaan wajib sebelum mulai:** PRD v3.0 untuk arsitektur dan filosofi desain. PRD Features v1.0 untuk spesifikasi enam fitur baru. AGENTS.md untuk dokumentasi teknis setiap AI agent.

---

## Tim

| Nama | NIM | Peran |
|------|-----|-------|
| Ida Putu Sucita Danuartha | 2301020069 | Project Manager, Frontend, UI/UX |
| I Gusti Ngurah Agung Adi Aryasuta | 2301020032 | Backend Developer, AI Engineer |
| Muhammad Nauval Faiq Khilmi | 2301020031 | Data Analyst, AI Engineer |

**Pembimbing:** I Nyoman Yudi Anggara Wijaya, S.Kom., M.T. — yudi@primakara.ac.id
**Institusi:** Universitas Primakara, Denpasar, Bali

---

## Aturan Umum

**Tanya sebelum membuat abstraksi baru.** Codebase ini untuk lomba dengan timeline 6 minggu. Over-engineering adalah musuh. Sebelum membuat base class atau utility function baru, pastikan ia digunakan di minimal tiga tempat.

**Bahasa konsisten per layer.** TypeScript strict mode di frontend. Python 3.12+ dengan type hints lengkap di semua function signature. Tidak ada `any` di TypeScript tanpa komentar alasan. Tidak ada function Python tanpa return type annotation.

**Jangan modifikasi `components/ui/`** kecuali ada bug yang jelas. Itu output shadcn/ui CLI. Kustomisasi di komponen yang menggunakannya.

**Setiap perubahan system prompt agent** harus disertai update di AGENTS.md dan minimal satu test case baru. Ini tidak opsional — lihat seksi "Aturan Modifikasi System Prompt" di AGENTS.md.

**Data source harga** adalah Panel Harga Kementan dan Info Pangan Jakarta. Bukan PIHPS Bank Indonesia. Jangan tukar ini tanpa diskusi tim.

---

## Konvensi Penamaan

**Frontend (TypeScript):**
- Komponen React: PascalCase (`FreshnessScoreBadge.tsx`)
- Custom hooks: camelCase prefix `use` (`useFreshnessScore.ts`)
- Types: PascalCase, suffix `Response` untuk API types (`BatchResponse`)
- Constants: UPPER_SNAKE_CASE (`FRESHNESS_THRESHOLDS`)

**Backend (Python):**
- Modules dan functions: snake_case
- Classes: PascalCase, suffix sesuai layer (`PriceAgent`, `BatchService`, `UserRouter`)
- Constants: UPPER_SNAKE_CASE (`COMMODITY_SHELF_LIFE_HOURS`)
- Celery tasks: verb phrase (`generate_farm_report`, `scan_all_active_batches`)

---

## Pola Kode Wajib

### Frontend: Semua HTTP call lewat `lib/api.ts`

Jangan pernah `fetch` langsung di komponen. Semua request lewat typed wrapper.

```typescript
// lib/api.ts
export async function getBatchFreshness(batchId: string): Promise<FreshnessResponse> {
  const response = await apiClient.get(`/batches/${batchId}/freshness`);
  return response.data;
}

// Di komponen atau hook — pakai ini
const freshness = await getBatchFreshness(batchId);
```

### Frontend: Server Component sebagai default

Tambahkan `"use client"` hanya jika komponen butuh: event handler interaktif, `useState`/`useEffect`, atau browser API. Data fetching di halaman publik wajib di Server Component untuk performa.

```typescript
// app/(public)/trace/[qr]/page.tsx — Server Component
// Tidak perlu "use client"
export default async function TraceabilityPage({ params }) {
  const batch = await getBatchByQR(params.qr);
  return <TraceabilityTimeline batch={batch} />;
}
```

### Frontend: proxy.ts untuk auth guard (Next.js 16)

`middleware.ts` deprecated di Next.js 16. Gunakan `proxy.ts`.

```typescript
// proxy.ts — di root frontend project
import { type ProxyConfig } from 'next/proxy';

export const config: ProxyConfig = {
  matcher: ['/farmer/:path*', '/distributor/:path*', '/admin/:path*'],
  async handle(request) {
    const token = request.cookies.get('auth_token');
    if (!token) {
      return Response.redirect(new URL('/login', request.url));
    }
    const role = extractRoleFromToken(token.value);
    if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
      return Response.redirect(new URL('/forbidden', request.url));
    }
    return request.next();
  }
};
```

### Backend: FastAPI Router + Dependency Injection

```python
# routers/batches.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.batch_service import BatchService
from schemas.batch import BatchCreate, BatchResponse
from models.user import User

router = APIRouter(prefix="/batches", tags=["batches"])

@router.post("/", response_model=BatchResponse, status_code=201)
async def create_batch(
    data: BatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Only farmers can create batches")
    service = BatchService(db)
    return await service.create(data, farmer_id=current_user.id)
```

### Backend: Service Layer wajib untuk logic yang lebih dari 5 baris

Logic bisnis tidak boleh ada di router. Router hanya: validasi input, panggil service, return response.

```python
# services/freshness_service.py
class FreshnessService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_and_update(self, batch_id: str) -> float:
        batch = await self.db.get(ProductBatch, batch_id)
        checkpoints = await self._get_checkpoints(batch_id)
        score = calculate_freshness_score(
            batch.commodity_name,
            batch.harvest_date,
            checkpoints,
        )
        batch.freshness_score = score
        batch.freshness_updated = datetime.now()
        await self.db.commit()
        return score
```

### Backend: Async everywhere

Semua database call harus async. Jangan mix sync SQLAlchemy dengan async FastAPI.

```python
# BENAR
async def get_user(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# SALAH — blocking call di async context
def get_user(user_id: str, db: Session) -> User:
    return db.query(User).filter(User.id == user_id).first()
```

### Backend: Cache sebelum LLM call

```python
async def get_price_recommendation(commodity: str, region: str, query: str) -> dict:
    cache_key = f"price_agent:{hashlib.md5(f'{commodity}{region}{query}'.encode()).hexdigest()}"

    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await price_agent.run(query, {"commodity": commodity, "region": region})
    await redis_client.setex(cache_key, 900, json.dumps(result))  # TTL 15 menit
    return result
```

### Backend: Error handling dengan konteks

```python
# BENAR — error informatif
async def fetch_panel_harga(commodity: str) -> dict:
    try:
        response = await httpx_client.get(PANEL_HARGA_URL, params={"komoditas": commodity})
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Panel Harga API error {e.response.status_code} for {commodity}")
        # Coba fallback ke cache
        cached = await redis_client.get(f"price_fallback:{commodity}")
        if cached:
            return {"data": json.loads(cached), "source": "cache_fallback"}
        raise AgentDataUnavailableError(f"Data harga {commodity} tidak tersedia")

# SALAH — silent failure
async def fetch_panel_harga(commodity: str) -> dict:
    try:
        response = await httpx_client.get(PANEL_HARGA_URL)
        return response.json()
    except:
        return {}
```

---

## Yang Tidak Boleh Dilakukan

**Jangan simpan secrets di kode.** Semua API key hanya di `.env`. Jika tidak sengaja commit, langsung rotate keynya.

**Jangan panggil LLM dari Next.js.** Semua AI call harus lewat: Next.js → Python backend → Agent. Tidak ada direct call ke Gemini/OpenAI API dari frontend.

**Jangan gunakan `console.log` di production.** Wrap dengan `if (process.env.NODE_ENV === 'development')`. Sama untuk `print()` di Python dan `logger.debug()` — pastikan level log sesuai.

**Jangan buat endpoint Python yang bisa diakses langsung dari internet.** Python backend hanya untuk internal call dari Next.js. Docker network configuration harus mencerminkan ini.

**Jangan modifikasi migration yang sudah di-commit.** Buat migration baru jika perlu mengubah skema.

**Jangan skip validasi Pydantic.** Semua input dari user harus melewati Pydantic schema sebelum menyentuh service atau agent. Ini penting terutama untuk endpoint yang meneruskan data ke LLM — prompt injection adalah risiko nyata.

---

## Setup Development

```bash
git clone <repo_url> yawgriva
cd yawgriva

# Copy dan isi semua env files
cp yawgriva-frontend/.env.example yawgriva-frontend/.env.local
cp yawgriva-backend/.env.example yawgriva-backend/.env

# Jalankan semua service
docker compose up -d

# Jalankan migration
docker compose exec backend alembic upgrade head

# Seed data awal (opsional, untuk development)
docker compose exec backend python scripts/seed.py

# Verifikasi semua berjalan
docker compose ps
```

**Port default:**
- Frontend: `localhost:3000`
- Backend: `localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Backend Python tidak boleh diakses langsung dari browser di production — hanya dari frontend container via Docker network.

---

## Urutan Implementasi Fitur Baru

Ikuti urutan ini untuk setiap fitur baru agar tidak ada dependency yang hilang:

1. Buat Alembic migration jika ada perubahan skema
2. Update atau buat SQLAlchemy model
3. Buat Pydantic schema (request + response)
4. Buat atau update service layer
5. Jika melibatkan agent: update AGENTS.md terlebih dahulu
6. Buat router dan endpoint
7. Update types di `yawgriva-frontend/types/index.ts`
8. Tambahkan fungsi di `lib/api.ts`
9. Buat komponen dan halaman Next.js
10. Tulis test untuk router dan service

---

## Pertanyaan yang Sering Muncul

**"Freshness Score dihitung di mana — frontend atau backend?"**
Selalu di backend (`services/freshness_service.py`). Frontend hanya menampilkan nilai yang sudah dihitung. Jangan pernah reimplementasi formula di TypeScript — akan ada inconsistency.

**"Kapan pakai RSC vs Client Component?"**
RSC untuk: halaman yang hanya menampilkan data (trace QR, detail batch). Client Component untuk: chat interface, form input, komponen dengan state interaktif. Jika ragu, mulai dengan RSC dan tambahkan `"use client"` jika ada error.

**"Berapa batas ukuran foto untuk Visual Agent?"**
5MB sebelum compression, 800px setelah compression sebelum dikirim ke Gemini Vision. Batasi maksimal 3 foto per batch. Jangan simpan foto di PostgreSQL — gunakan object storage.

**"Community Price Report bisa dimanipulasi tidak?"**
Bisa, tapi sudah ada tiga layer validasi: rate limiting per petani per hari (Redis TTL), outlier detection (3× standar deviasi), dan reporter weight berdasarkan accuracy historis. Jika ada laporan suspect, tandai sebagai `suspect` dan jangan masukkan ke agregasi.

**"Carbon Footprint angkanya dari mana?"**
Dari IPCC Transport Guidelines 2023, di-hardcode di `EMISSION_FACTORS` dalam `carbon_service.py`. Ini estimasi, bukan pengukuran akurat — selalu tampilkan disclaimer "estimasi" di UI. Jangan biarkan user mengira ini angka pasti.

**"Bagaimana cara test agent tanpa menghabiskan token?"**
Gunakan `pytest-mock` untuk mock semua LLM call di unit test. Integration test yang memanggil API sungguhan hanya dijalankan manual dengan flag `--integration`. Lihat `tests/conftest.py` untuk fixture mock yang sudah disiapkan.