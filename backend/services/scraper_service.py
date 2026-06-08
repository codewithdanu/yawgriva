# ASSUMPTIONS:
# 1. Bapanas WebAPI (formerly Panel Harga Kementan) is expected to return a JSON object with a "data" list,
#    where each item contains "komoditas_id", "harga", and "pasar" keys.
# 2. PIHPS BI GetGridData endpoint is a POST request that accepts a JSON payload of:
#    { "komoditas": str, "tglAwal": str, "tglAkhir": str, "jenisHarga": str }.
#    The dates are formatted as "dd-mm-yyyy".
# 3. PIHPS BI returns a JSON response containing a list of records under the key "data" or directly as a list,
#    with each item having "market_name", "province", "price", and optionally "date".
# 4. In production, we never call _generate_simulated_live_data. In non-production, we can fall back to it
#    if all network calls fail, to facilitate testing/local development.

"""
Scraper service — fetch live horticultural prices from official Indonesian public sources:
1. Badan Pangan Nasional (Panel Harga Bapanas)
2. PIHPS Bank Indonesia (fallback)
"""

import logging
import random
import os
import functools
import warnings
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from services.exceptions import DataUnavailableError, ParseError, RateLimitError

logger = logging.getLogger(__name__)

# Official public data sources mapping
KEMENTAN_PANEL_URL = "https://webapi.badanpangan.go.id/api/v1/harga-eceran"

COMMODITY_MAPPING = {
    "cabai_merah": {"kementan_id": "31", "name": "Cabai Merah Keriting"},
    "cabai_rawit": {"kementan_id": "32", "name": "Cabai Rawit Merah"},
    "tomat": {"kementan_id": "52", "name": "Tomat"},
    "bawang_merah": {"kementan_id": "29", "name": "Bawang Merah"},
    "bawang_putih": {"kementan_id": "30", "name": "Bawang Putih Bonggol"},
    "kangkung": {"kementan_id": "99", "name": "Kangkung"},
}

PIHPS_COMMODITY_MAP = {
    "cabai_merah": "com_14",
    "cabai_rawit": "com_16",
    "bawang_merah": "com_11",
    "bawang_putih": "com_12",
}



def deprecated(func):
    """Decorator to mark functions as deprecated and log a warning."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        warnings.warn(
            f"{func.__name__} is deprecated and will be removed in a future version.",
            category=DeprecationWarning,
            stacklevel=2
        )
        logger.warning(f"WARNING: Call to deprecated function {func.__name__} returned simulated/fake data.")
        return func(*args, **kwargs)
    return wrapper


def is_network_or_5xx(exception: Exception) -> bool:
    """Helper to determine if tenacity should retry the request."""
    if isinstance(exception, httpx.HTTPStatusError):
        return exception.response.status_code >= 500
    if isinstance(exception, httpx.RequestError):
        return True
    return False


class PriceScraperService:
    """Service to fetch official horticultural price data."""

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        retry=retry_if_exception(is_network_or_5xx),
        reraise=True
    )
    async def _send_request_with_retry(self, method: str, url: str, **kwargs) -> httpx.Response:
        """Send HTTP request with retry logic on network errors and 5xx."""
        response = await self.client.request(method, url, **kwargs)
        if response.status_code in (401, 403):
            logger.error("API key invalid atau expired")
            raise PermissionError("API key invalid atau expired")
        elif response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "60")
            raise RateLimitError(f"Rate limit exceeded. Retry after {retry_after}s", retry_after=retry_after)
        response.raise_for_status()
        return response

    async def fetch_kementan_prices(self) -> List[Dict[str, Any]]:
        """
        Fetch latest prices from Panel Harga Badan Pangan / Kementan.
        """
        bapanas_api_key = os.getenv("BAPANAS_API_KEY")
        if not bapanas_api_key:
            raise PermissionError("Bapanas API key (BAPANAS_API_KEY) is not set")

        headers = {
            "Authorization": f"Bearer {bapanas_api_key}"
        }

        try:
            response = await self._send_request_with_retry("GET", KEMENTAN_PANEL_URL, headers=headers)
            data = response.json()
            logger.info("Successfully fetched live data from Panel Harga Kementan/Bapanas.")
            return self._parse_kementan_response(data)
        except Exception as e:
            if isinstance(e, (PermissionError, RateLimitError)):
                raise e
            env = os.getenv("ENV", "development")
            if env == "production":
                raise e
            logger.warning(f"Bapanas API failed, falling back to simulated data: {e}")
            return self._generate_simulated_live_data("panel_harga_kementan")

    async def fetch_jakarta_prices(self) -> List[Dict[str, Any]]:
        """
        Fetch latest prices from PIHPS BI.
        """
        all_parsed_records = []
        now = datetime.now(timezone.utc)
        tgl_awal = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        tgl_akhir = now.strftime("%Y-%m-%d")

        for local_name, pihps_code in PIHPS_COMMODITY_MAP.items():
            params = {
                "price_type_id": "1",
                "comcat_id": pihps_code,
                "province_id": "13",  # DKI Jakarta
                "regency_id": "",
                "market_id": "",
                "tipe_laporan": "1",
                "start_date": tgl_awal,
                "end_date": tgl_akhir
            }
            try:
                response = await self._send_request_with_retry(
                    "GET",
                    "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataDaerah",
                    params=params
                )
                data = response.json()
                records = self._parse_jakarta_response(data, local_name)
                all_parsed_records.extend(records)
            except Exception as e:
                if isinstance(e, (PermissionError, RateLimitError)):
                    raise e
                logger.warning(f"PIHPS BI fetch failed for commodity '{local_name}': {e}")
                env = os.getenv("ENV", "development")
                if env == "production":
                    raise e

        if not all_parsed_records:
            env = os.getenv("ENV", "development")
            if env == "production":
                raise DataUnavailableError("PIHPS BI fetch returned no records")
            logger.warning("PIHPS BI fetched 0 records. Falling back to simulated data.")
            return self._generate_simulated_live_data("info_pangan_jakarta")

        return all_parsed_records

    def _parse_kementan_response(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse raw Kementan JSON response into unified schema."""
        if not isinstance(data, dict):
            raise ParseError("Bapanas response is not a JSON object")

        parsed_records = []
        raw_list = data.get("data")
        if raw_list is None:
            raise ParseError("Bapanas response is missing 'data' list")

        if not isinstance(raw_list, list):
            raise ParseError("Bapanas response 'data' is not a list")

        for item in raw_list:
            if not isinstance(item, dict):
                continue
            komoditas_id = item.get("komoditas_id")
            if komoditas_id is None:
                continue
            komoditas_id = str(komoditas_id)

            # Map kementan_id back to our local commodity name
            local_name = None
            for key, mapping in COMMODITY_MAPPING.items():
                if mapping["kementan_id"] == komoditas_id:
                    local_name = key
                    break

            if local_name:
                try:
                    price = float(item.get("harga", 0))
                except (ValueError, TypeError) as e:
                    raise ParseError(f"Invalid price value: {item.get('harga')}") from e

                parsed_records.append({
                    "commodity_name": local_name,
                    "market_name": item.get("pasar", "Pasar Induk Kramat Jati"),
                    "price_per_kg": price,
                    "recorded_at": datetime.now(timezone.utc),
                    "source": "panel_harga_kementan"
                })
        return parsed_records

    def _parse_jakarta_response(self, data: Dict[str, Any], commodity_name: str | None = None) -> List[Dict[str, Any]]:
        """Parse raw Info Pangan Jakarta / PIHPS BI API response."""
        import re
        if not isinstance(data, dict):
            raise ParseError("PIHPS BI response is not a JSON object")

        parsed_records = []
        raw_list = data.get("data", [])
        if not isinstance(raw_list, list):
            if isinstance(data, list):
                raw_list = data
            else:
                raise ParseError("PIHPS BI response 'data' is not a list")

        date_pattern = re.compile(r"^\d{2}/\d{2}/\d{4}$")

        for item in raw_list:
            if not isinstance(item, dict):
                continue

            # Only parse level 2 items (specific commodities, not parent categories)
            if item.get("level") != 2:
                continue

            # Iterate through keys to find dates
            for key, val in item.items():
                if date_pattern.match(key):
                    if not val or str(val).strip() in ("", "-", " - "):
                        continue
                    try:
                        # Clean price string (e.g. "62,800" -> 62800.0)
                        cleaned_val = str(val).replace(",", "").strip()
                        price = float(cleaned_val)
                    except (ValueError, TypeError):
                        continue

                    try:
                        # Parse date (dd/MM/yyyy)
                        parsed_date = datetime.strptime(key, "%d/%m/%Y")
                        recorded_at = parsed_date.replace(tzinfo=timezone.utc)
                    except ValueError as e:
                        raise ParseError(f"Invalid date format in BI response: {key}") from e

                    parsed_records.append({
                        "commodity_name": commodity_name or "cabai_merah",
                        "market_name": "Semua Pasar (DKI Jakarta)",
                        "province": "DKI Jakarta",
                        "price_per_kg": price,
                        "recorded_at": recorded_at,
                        "source": "info_pangan_jakarta"
                    })

        return parsed_records

    async def fetch_prices(self) -> List[Dict[str, Any]]:
        """
        Fetch prices using Bapanas as primary (if BAPANAS_API_KEY available) and PIHPS BI as fallback.
        """
        bapanas_api_key = os.getenv("BAPANAS_API_KEY")
        errors = []

        if bapanas_api_key:
            try:
                logger.info("Attempting to fetch prices from primary source: Bapanas WebAPI")
                return await self.fetch_kementan_prices()
            except PermissionError as e:
                logger.error(f"Permission error fetching from Bapanas WebAPI: {e}")
                raise e
            except Exception as e:
                logger.warning(f"Bapanas WebAPI failed: {e}. Falling back to PIHPS BI.")
                errors.append(f"Bapanas: {str(e)}")

        # Fallback 1: PIHPS BI
        try:
            logger.info("Attempting to fetch prices from fallback source: PIHPS BI")
            return await self.fetch_jakarta_prices()
        except Exception as e:
            logger.error(f"PIHPS BI fetch failed: {e}")
            errors.append(f"PIHPS BI: {str(e)}")

        # Fallback 2: raise DataUnavailableError or simulated data in dev
        env = os.getenv("ENV", "development")
        if env == "production":
            msg = f"All price data sources failed. Errors: {'; '.join(errors)}"
            logger.error(msg)
            raise DataUnavailableError(msg)
        else:
            logger.warning("All price data sources failed. Generating simulated data for local development/test.")
            return self._generate_simulated_live_data("panel_harga_kementan") + self._generate_simulated_live_data("info_pangan_jakarta")

    @deprecated
    def _generate_simulated_live_data(self, source: str) -> List[Dict[str, Any]]:
        """Generates realistic fluctuations based on Indonesian commodity statistics."""
        simulated = []
        base_prices = {
            "cabai_merah": 42000,
            "cabai_rawit": 58000,
            "tomat": 13500,
            "bawang_merah": 36000,
            "kangkung": 7500,
        }
        markets = [
            "Pasar Induk Kramat Jati",
            "Pasar Induk Caringin Bandung",
            "Pasar Gede Solo",
            "Pasar Legi Surabaya",
            "Pasar Badung Denpasar",
        ]

        for comm, base in base_prices.items():
            for market in markets:
                # Add random fluctuation based on market volatility
                fluctuation = random.uniform(-0.04, 0.04)
                price = round(base * (1 + fluctuation), -2)  # round to nearest 100
                simulated.append({
                    "commodity_name": comm,
                    "market_name": market,
                    "price_per_kg": price,
                    "recorded_at": datetime.now(timezone.utc),
                    "source": source
                })
        return simulated

    async def close(self):
        await self.client.aclose()
