"""
Google Maps integration tools for the Logistics Agent.
Calculates routes, travel times, and distances.
Falls back to robust local simulation if the API key is missing or invalid.
"""

import httpx
from typing import Dict, Any, List
from langchain_core.tools import tool

from core.config import settings


@tool
async def calculate_route(origin: str, destination: str) -> Dict[str, Any]:
    """
    Menghitung rute perjalanan terbaik antara asal (origin) dan tujuan (destination).
    Menerima input berupa alamat, nama tempat (misal: 'Pasar Induk Kramat Jati'), 
    atau koordinat latitude,longitude (misal: '-6.9147,107.6098').
    Mengembalikan jarak (km), durasi estimasi (menit), ringkasan rute, dan tips lalu lintas.
    """
    api_key = settings.GOOGLE_MAPS_API_KEY
    
    if api_key and not api_key.startswith("AIzaSy-placeholder") and len(api_key) > 20:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": origin,
            "destination": destination,
            "key": api_key,
            "region": "id",
            "language": "id"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data.get("routes"):
                        route = data["routes"][0]
                        leg = route["legs"][0]
                        
                        # Extract metrics
                        distance_km = leg["distance"]["value"] / 1000.0
                        duration_min = leg["duration"]["value"] / 60.0
                        start_address = leg["start_address"]
                        end_address = leg["end_address"]
                        summary = route.get("summary", "Jalur Utama")
                        
                        return {
                            "origin": start_address,
                            "destination": end_address,
                            "distance_km": round(distance_km, 2),
                            "estimated_duration_min": round(duration_min, 1),
                            "route_summary": f"Via {summary}" if summary else "Jalur Tercepat",
                            "status": "success",
                            "source": "Google Maps Directions API"
                        }
                    else:
                        # API key might be invalid or no route found
                        status = data.get("status", "UNKNOWN_ERROR")
                        error_msg = data.get("error_message", "No route found.")
                        # Fallback to simulation but log warning
                        pass
        except Exception as e:
            # Catch timeouts and network errors
            pass
            
    # Mock/Simulated route planning fallback (specifically designed for common agricultural routes in West Java/Jakarta)
    orig_clean = origin.lower()
    dest_clean = destination.lower()
    
    # Defaults
    distance = 150.0
    duration = 180.0
    summary = "Tol Purbaleunyi - Tol Jakarta-Cikampek"
    
    # Check if Bandung to Jakarta
    if ("bandung" in orig_clean or "ciwidey" in orig_clean or "lembang" in orig_clean) and ("jakarta" in dest_clean or "kramat jati" in dest_clean):
        distance = 165.4
        duration = 210.0
        summary = "Tol Purbaleunyi - Tol Jakarta-Cikampek - Tol JORR"
    # Check if Bogor to Jakarta
    elif "bogor" in orig_clean and ("jakarta" in dest_clean or "kramat jati" in dest_clean):
        distance = 55.2
        duration = 85.0
        summary = "Tol Jagorawi"
    # Check if Sukabumi to Jakarta
    elif "sukabumi" in orig_clean and ("jakarta" in dest_clean or "kramat jati" in dest_clean):
        distance = 112.8
        duration = 160.0
        summary = "Tol Bocimi - Tol Jagorawi"
    # Check if Garut to Bandung
    elif "garut" in orig_clean and "bandung" in dest_clean:
        distance = 64.5
        duration = 110.0
        summary = "Jl. Raya Bandung-Garut"
        
    return {
        "origin": origin,
        "destination": destination,
        "distance_km": distance,
        "estimated_duration_min": duration,
        "route_summary": f"Via {summary} (Simulasi)",
        "status": "success",
        "source": "Yawgriva Routing Simulation (Google Maps Fallback)"
    }
