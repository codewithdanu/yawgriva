"""
Weather forecasting tools for AI agents.
Fetches forecast data using Open-Meteo API (no key required) or falls back to mock data.
Provides BMKG-like Indonesian descriptions.
"""

import httpx
from typing import Dict, Any
from langchain_core.tools import tool

# WMO Weather Code translations to BMKG-style Indonesian descriptions
WEATHER_CODES = {
    0: "Cerah",
    1: "Cerah Berawan",
    2: "Berawan",
    3: "Berawan Tebal",
    45: "Kabut",
    48: "Kabut Rime",
    51: "Gerimis Ringan",
    53: "Gerimis Sedang",
    55: "Gerimis Lebat",
    56: "Gerimis Beku Ringan",
    57: "Gerimis Beku Lebat",
    61: "Hujan Ringan",
    63: "Hujan Sedang",
    65: "Hujan Lebat",
    66: "Hujan Beku Ringan",
    67: "Hujan Beku Lebat",
    71: "Hujan Salju Ringan",
    73: "Hujan Salju Sedang",
    75: "Hujan Salju Lebat",
    77: "Butiran Salju",
    80: "Hujan Showers Ringan",
    81: "Hujan Showers Sedang",
    82: "Hujan Showers Lebat",
    85: "Hujan Salju Showers Ringan",
    86: "Hujan Salju Showers Lebat",
    95: "Badai Petir Ringan/Sedang",
    96: "Badai Petir dengan Hujan Es Ringan",
    99: "Badai Petir dengan Hujan Es Lebat"
}


@tool
async def get_weather_forecast(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Mendapatkan prakiraan cuaca (suhu maks/min, curah hujan, deskripsi cuaca) 
    untuk koordinat latitude dan longitude tertentu di Indonesia.
    Mengembalikan prakiraan cuaca harian selama 3 hari ke depan.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "Asia/Jakarta",
        "forecast_days": 3
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                daily = data.get("daily", {})
                
                forecasts = []
                for i in range(len(daily.get("time", []))):
                    code = daily.get("weathercode", [0])[i]
                    desc = WEATHER_CODES.get(code, "Berawan")
                    forecasts.append({
                        "date": daily.get("time", [])[i],
                        "max_temp_celsius": daily.get("temperature_2m_max", [25.0])[i],
                        "min_temp_celsius": daily.get("temperature_2m_min", [20.0])[i],
                        "precipitation_mm": daily.get("precipitation_sum", [0.0])[i],
                        "description": desc
                    })
                    
                return {
                    "location": {"latitude": latitude, "longitude": longitude},
                    "forecast": forecasts,
                    "source": "Open-Meteo (BMKG Mapping)"
                }
    except Exception as e:
        # Fallback to mock data in case of request timeout/failure
        pass
        
    # Fallback response
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "forecast": [
            {
                "date": "Hari Ini",
                "max_temp_celsius": 31.5,
                "min_temp_celsius": 24.0,
                "precipitation_mm": 2.5,
                "description": "Cerah Berawan"
            },
            {
                "date": "Besok",
                "max_temp_celsius": 30.0,
                "min_temp_celsius": 23.5,
                "precipitation_mm": 12.0,
                "description": "Hujan Sedang"
            },
            {
                "date": "Lusa",
                "max_temp_celsius": 29.0,
                "min_temp_celsius": 23.0,
                "precipitation_mm": 18.5,
                "description": "Badai Petir Ringan/Sedang"
            }
        ],
        "source": "Mock Forecast (API Timeout)"
    }
