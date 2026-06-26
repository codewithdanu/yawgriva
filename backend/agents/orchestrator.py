"""
Orchestrator Agent implementation.
Classifies user intent and routes conversation to the correct specialized agent.
"""

import json
from typing import Dict, Any, Tuple, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from core.config import settings
from agents.base import get_main_ai_model
from agents.price_agent import PriceAgent
from agents.logistics_agent import LogisticsAgent
from agents.anomaly_agent import AnomalyAgent


CLASSIFICATION_PROMPT = """
Klasifikasikan pesan pengguna berikut ke dalam salah satu kategori:
- "price": Jika menanyakan harga komoditas, tren/prediksi harga, keputusan panen/penjualan, atau cuaca yang memengaruhi hasil panen/harga.
- "logistics": Jika menanyakan rute pengiriman, estimasi waktu transit, degradasi kesegaran produk (freshness score), atau logistik logis.
- "anomaly": Jika menanyakan anomali, masalah suhu (cold chain), keterlambatan pengiriman batch, peringatan (alert), atau pengecekan keamanan batch.
- "general": Jika berupa salam (halo, hai), obrolan santai, perkenalan diri, penjelasan sistem, atau di luar topik pertanian spesifik di atas.

Keluaran Anda harus HANYA salah satu kata berikut dalam huruf kecil, tanpa tanda baca, penjelasan, atau teks tambahan: "price", "logistics", "anomaly", "general".

Pesan Pengguna: "{message}"
Kategori:
"""

GENERAL_SYSTEM_PROMPT = """
Anda adalah Yawgriva AI Assistant, asisten digital cerdas untuk rantai pasok hortikultura Yawgriva di Indonesia.
Tugas Anda adalah memandu pengguna dan menjelaskan fitur-fitur Yawgriva secara ramah.

Fitur utama yang bisa Anda jelaskan:
1. Analisis & Prediksi Harga (Price Intelligence Agent)
2. Optimasi & Estimasi Kesegaran Rute (Logistics Agent)
3. Pendeteksi Anomali & Suhu Batch Rantai Pasok (Anomaly Agent)

Selalu berikan jawaban dalam Bahasa Indonesia yang ramah, profesional, dan ringkas. Jika pengguna menanyakan hal yang sangat spesifik tentang rute, harga, atau anomali batch, beri tahu mereka bahwa Anda dapat memprosesnya jika mereka memberikan detail (seperti nama komoditas, lokasi asal/tujuan, atau hash QR code).
"""


def _build_user_context_prompt(user_context: Optional[dict]) -> str:
    """Build a personalized context paragraph from the user's profile data."""
    if not user_context:
        return ""
    
    lines = ["\n\n--- KONTEKS PENGGUNA (gunakan informasi ini, JANGAN tanyakan ulang) ---"]
    
    if user_context.get("name"):
        lines.append(f"Nama pengguna: {user_context['name']}")
    if user_context.get("role"):
        role_map = {"farmer": "Petani", "distributor": "Distributor", "admin": "Administrator"}
        lines.append(f"Peran: {role_map.get(user_context['role'], user_context['role'])}")
    if user_context.get("region"):
        lines.append(f"Wilayah: {user_context['region']}")
    if user_context.get("farm_location"):
        lines.append(f"Lokasi lahan/usaha: {user_context['farm_location']}")
    if user_context.get("land_area"):
        lines.append(f"Luas lahan: {user_context['land_area']}")
    if user_context.get("phone"):
        lines.append(f"Nomor telepon: {user_context['phone']}")
    
    lines.append("--- AKHIR KONTEKS PENGGUNA ---")
    return "\n".join(lines)


class Orchestrator:
    def __init__(self):
        self.price_agent = PriceAgent()
        self.logistics_agent = LogisticsAgent()
        self.anomaly_agent = AnomalyAgent()

    def _get_gemini_llm(self, model_name: str, temperature: float = 0.0):
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=temperature
        )

    def _get_fallback_llm(self):
        return ChatOpenAI(
            model="gpt-4o-mini",
            api_key=settings.OPENAI_API_KEY,
            temperature=0.0
        )

    async def classify_intent(self, message: str) -> str:
        """Classify user message into: price, logistics, anomaly, general."""
        prompt = CLASSIFICATION_PROMPT.format(message=message)
        
        main_model = await get_main_ai_model()
        
        gemini_models = [
            "gemini-2.5-flash",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-3-flash-preview",
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite"
        ]
        
        models_to_try = []
        if main_model == "openai":
            models_to_try.append(("openai", "gpt-4o-mini"))
            for m in gemini_models:
                models_to_try.append(("gemini", m))
        else:
            for m in gemini_models:
                models_to_try.append(("gemini", m))
            models_to_try.append(("openai", "gpt-4o-mini"))

        category = "general"
        for provider, model_name in models_to_try:
            try:
                if provider == "gemini":
                    llm = self._get_gemini_llm(model_name, temperature=0.0)
                else:
                    llm = self._get_fallback_llm()
                resp = await llm.ainvoke([HumanMessage(content=prompt)])
                category = resp.content.strip().lower()
                break  # Success!
            except Exception as e:
                print(f"Orchestrator classification failed on {provider}/{model_name}: {e}. Trying next model...")
                
        # Guard against weird LLM responses
        valid_categories = {"price", "logistics", "anomaly", "general"}
        for cat in valid_categories:
            if cat in category:
                return cat
                
        return "general"

    async def execute_stream(self, message: str, role: str = "farmer", user_context: Optional[dict] = None):
        """
        Classifies intent and yields streamed responses from the target agent.
        user_context: dict with optional keys: name, role, region, farm_location, land_area, phone
        """
        yield {"status": "Mengklasifikasikan maksud pertanyaan Anda..."}
        
        # Build context suffix to inject into each agent's system prompt
        context_suffix = _build_user_context_prompt(user_context)
        
        intent = await self.classify_intent(message)
        yield {"status": f"Mengarahkan ke Agen: {intent.upper()}..."}
        
        if intent == "price":
            async for chunk in self.price_agent.execute_stream(message, context_suffix=context_suffix):
                yield chunk
        elif intent == "logistics":
            async for chunk in self.logistics_agent.execute_stream(message, context_suffix=context_suffix):
                yield chunk
        elif intent == "anomaly":
            async for chunk in self.anomaly_agent.execute_stream(message, context_suffix=context_suffix):
                yield chunk
        else:
            # Handle general conversation directly in Orchestrator
            import asyncio
            reply = await self._generate_general_response(message, context_suffix=context_suffix)
            words = reply.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield {"chunk": chunk}
                await asyncio.sleep(0.02)
            yield {"done": True, "model": "gemini-2.5-flash", "confidence": 0.9}

    async def _generate_general_response(self, message: str, context_suffix: str = "") -> str:
        """Generate response for general conversational messages."""
        main_model = await get_main_ai_model()
        
        gemini_models = [
            "gemini-2.5-flash",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-3-flash-preview",
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite"
        ]
        
        models_to_try = []
        if main_model == "openai":
            models_to_try.append(("openai", "gpt-4o-mini"))
            for m in gemini_models:
                models_to_try.append(("gemini", m))
        else:
            for m in gemini_models:
                models_to_try.append(("gemini", m))
            models_to_try.append(("openai", "gpt-4o-mini"))
        
        system_content = GENERAL_SYSTEM_PROMPT + context_suffix
        
        for provider, model_name in models_to_try:
            try:
                if provider == "gemini":
                    llm = self._get_gemini_llm(model_name, temperature=0.7)
                else:
                    llm = ChatOpenAI(
                        model="gpt-4o-mini",
                        api_key=settings.OPENAI_API_KEY,
                        temperature=0.7
                    )
                messages = [
                    SystemMessage(content=system_content),
                    HumanMessage(content=message)
                ]
                resp = await llm.ainvoke(messages)
                return resp.content
            except Exception as e:
                print(f"Orchestrator general response failed on {provider}/{model_name}: {e}. Trying next fallback...")
        else:
            return (
                "Halo! Saya Yawgriva AI Assistant. Saya bisa membantu Anda memantau "
                "harga pasar komoditas, merekomendasikan rute logistik tercepat untuk menjaga "
                "kesegaran produk, serta mendeteksi anomali suhu/pengiriman pada batch produk Anda. "
                "Silakan ajukan pertanyaan terkait hal tersebut!"
            )
