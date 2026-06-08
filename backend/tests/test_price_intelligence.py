import pytest
import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from services.exceptions import DataUnavailableError, ParseError, RateLimitError
from services.scraper_service import PriceScraperService, deprecated
from services.price_service import PriceService
from models.price import CommodityPrice, PricePrediction

import httpx

@pytest.mark.asyncio
async def test_custom_exceptions():
    """Verify custom exceptions behave correctly."""
    with pytest.raises(DataUnavailableError):
        raise DataUnavailableError("All failed")
        
    with pytest.raises(ParseError):
        raise ParseError("JSON invalid")
        
    with pytest.raises(RateLimitError) as exc_info:
        raise RateLimitError("Too many requests", retry_after="120")
    assert exc_info.value.retry_after == "120"


@pytest.mark.asyncio
@patch("services.scraper_service.os.getenv")
async def test_scraper_bapanas_api_headers(mock_getenv):
    """Test Bapanas WebAPI request includes the Auth headers when API key is set."""
    mock_getenv.side_effect = lambda key, default=None: "mock_api_key" if key == "BAPANAS_API_KEY" else default
    
    scraper = PriceScraperService()
    
    # Mock HTTP response
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json = MagicMock(return_value={"data": [{"komoditas_id": "31", "harga": 45000, "pasar": "Kramat Jati"}]})
    
    with patch.object(scraper.client, "request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        
        prices = await scraper.fetch_kementan_prices()
        
        assert len(prices) == 1
        assert prices[0]["commodity_name"] == "cabai_merah"
        assert prices[0]["price_per_kg"] == 45000.0
        
        # Verify call arguments
        mock_request.assert_called_once()
        args, kwargs = mock_request.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer mock_api_key"
    await scraper.close()


@pytest.mark.asyncio
@patch("services.scraper_service.os.getenv")
async def test_scraper_authorization_error(mock_getenv):
    """Test that HTTP 401/403 raises PermissionError and does not retry."""
    mock_getenv.side_effect = lambda key, default=None: "mock_api_key" if key == "BAPANAS_API_KEY" else default
    
    scraper = PriceScraperService()
    
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 401
    
    with patch.object(scraper.client, "request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        
        with pytest.raises(PermissionError):
            await scraper.fetch_kementan_prices()
            
        # PermissionError should not trigger retries
        assert mock_request.call_count == 1
    await scraper.close()


@pytest.mark.asyncio
@patch("services.scraper_service.os.getenv")
async def test_scraper_rate_limit_error(mock_getenv):
    """Test that HTTP 429 raises RateLimitError and parses Retry-After."""
    mock_getenv.side_effect = lambda key, default=None: "mock_api_key" if key == "BAPANAS_API_KEY" else default
    
    scraper = PriceScraperService()
    
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 429
    mock_response.headers = {"Retry-After": "45"}
    
    with patch.object(scraper.client, "request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        
        with pytest.raises(RateLimitError) as exc_info:
            await scraper.fetch_kementan_prices()
            
        assert exc_info.value.retry_after == "45"
        # 429 should not trigger tenacity retries (only network and 5xx)
        assert mock_request.call_count == 1
    await scraper.close()


@pytest.mark.asyncio
@patch("services.scraper_service.os.getenv")
async def test_scraper_fetch_prices_fallback_flow(mock_getenv):
    """Verify the primary -> fallback 1 -> fallback 2 sequence in fetch_prices."""
    # Scenario: Bapanas key exists but request fails with 500 error. Fallback to PIHPS works.
    mock_getenv.side_effect = lambda key, default=None: "mock_key" if key == "BAPANAS_API_KEY" else ("production" if key == "ENV" else default)
    
    scraper = PriceScraperService()
    
    # Mock Bapanas response failing with 500
    mock_bapanas_resp = MagicMock(spec=httpx.Response)
    mock_bapanas_resp.status_code = 500
    mock_bapanas_resp.raise_for_status.side_effect = httpx.HTTPStatusError("500 Internal Error", request=None, response=mock_bapanas_resp)
    
    # Mock PIHPS response succeeding
    mock_pihps_resp = MagicMock(spec=httpx.Response)
    mock_pihps_resp.status_code = 200
    mock_pihps_resp.json = MagicMock(return_value={"data": [{"market_name": "Pasar Gede", "province": "Jawa Tengah", "price": 32000, "date": "2026-06-05"}]})
    
    with patch.object(scraper.client, "request", new_callable=AsyncMock) as mock_request:
        # Bapanas request fails 3 times due to tenacity retry, then PIHPS is called
        mock_request.side_effect = [mock_bapanas_resp, mock_bapanas_resp, mock_bapanas_resp, mock_pihps_resp]
        
        # We also need to mock or define the rest of PIHPS requests since it loops commodities.
        # For this test, let's patch fetch_jakarta_prices directly to simplify the fallback validation,
        # or patch request to handle all loops. Let's patch request side_effect.
        # Bapanas call = 3 retries.
        # PIHPS loop has 6 commodities. We can mock them returning mock_pihps_resp.
        mock_request.side_effect = [mock_bapanas_resp, mock_bapanas_resp, mock_bapanas_resp] + [mock_pihps_resp]*6
        
        prices = await scraper.fetch_prices()
        assert len(prices) == 6
        assert prices[0]["price_per_kg"] == 32000.0
        assert prices[0]["source"] == "info_pangan_jakarta"
        
    await scraper.close()


@pytest.mark.asyncio
async def test_price_service_refresh_prices_upsert():
    """Verify refresh_prices inserts new data and ignores existing duplicates."""
    db_mock = AsyncMock()
    
    # Mock existing commodity prices in database
    existing_price = CommodityPrice(
        commodity_name="cabai_merah",
        market_name="Pasar Kramat Jati",
        price_per_kg=40000.0,
        recorded_at=datetime(2026, 6, 5, tzinfo=timezone.utc),
        source="info_pangan_jakarta"
    )
    
    mock_execute_res = MagicMock()
    mock_execute_res.scalars.return_value.all.return_value = [existing_price]
    db_mock.execute.return_value = mock_execute_res
    
    # Mock scraper service fetch_prices response
    fetched_data = [
        # Duplicate record
        {
            "commodity_name": "cabai_merah",
            "market_name": "Pasar Kramat Jati",
            "price_per_kg": 42000.0,
            "recorded_at": datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc),
            "source": "info_pangan_jakarta"
        },
        # New record
        {
            "commodity_name": "cabai_rawit",
            "market_name": "Pasar Legi Surabaya",
            "price_per_kg": 55000.0,
            "recorded_at": datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc),
            "source": "info_pangan_jakarta"
        }
    ]
    
    price_svc = PriceService(db=db_mock)
    
    with patch("services.price_service.PriceScraperService") as mock_scraper_cls:
        mock_scraper_inst = MagicMock()
        mock_scraper_inst.fetch_prices = AsyncMock(return_value=fetched_data)
        mock_scraper_inst.close = AsyncMock()
        mock_scraper_cls.return_value = mock_scraper_inst
        
        inserted_count = await price_svc.refresh_prices()
        
        assert inserted_count == 1
        db_mock.add.assert_called_once()
        db_mock.commit.assert_called_once()


@pytest.mark.asyncio
@patch("services.price_service.os.getenv")
async def test_price_service_seeding_guard(mock_getenv):
    """Test seed_development_data fails with RuntimeError in production env."""
    mock_getenv.return_value = "production"
    db_mock = AsyncMock()
    
    with pytest.raises(RuntimeError) as exc_info:
        await PriceService.seed_development_data(db_mock)
    assert "Cannot run seeding" in str(exc_info.value)


@pytest.mark.asyncio
async def test_price_service_predictions():
    """Verify prediction statistical routing (SES vs WMA vs None) and MAPE confidence mapping."""
    db_mock = AsyncMock()
    price_svc = PriceService(db=db_mock)
    
    # 1. Test data < 7 days -> Returns None
    mock_execute_res = MagicMock()
    mock_execute_res.scalars.return_value.all.return_value = [
        CommodityPrice(
            commodity_name="tomat",
            market_name="Pasar Gede Solo",
            price_per_kg=12000,
            recorded_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            source="panel_harga_kementan"
        )
    ]
    db_mock.execute.return_value = mock_execute_res
    
    prediction = await price_svc.generate_prediction("tomat", "Jawa Tengah")
    assert prediction is None
    
    # 2. Test data 7-29 days -> Weighted Moving Average (WMA)
    wma_data = []
    base_date = datetime(2026, 5, 1, tzinfo=timezone.utc)
    for i in range(10):
        # 10 days of stable data (price=10000)
        wma_data.append(CommodityPrice(
            commodity_name="tomat",
            market_name="Pasar Gede Solo",
            price_per_kg=10000.0,
            recorded_at=base_date + timedelta(days=i),
            source="panel_harga_kementan"
        ))
    mock_execute_res.scalars.return_value.all.return_value = wma_data
    
    prediction = await price_svc.generate_prediction("tomat", "Jawa Tengah")
    assert prediction is not None
    assert prediction.predicted_price == 10000.0
    assert prediction.confidence == 0.90  # MAPE is 0.0 (exact fit)
    
    # 3. Test data >= 30 days -> Simple Exponential Smoothing (SES)
    ses_data = []
    for i in range(35):
        # 35 days of data
        ses_data.append(CommodityPrice(
            commodity_name="tomat",
            market_name="Pasar Gede Solo",
            price_per_kg=10000.0 + (i % 2) * 500,  # Fluctuating slightly
            recorded_at=base_date + timedelta(days=i),
            source="panel_harga_kementan"
        ))
    mock_execute_res.scalars.return_value.all.return_value = ses_data
    
    prediction = await price_svc.generate_prediction("tomat", "Jawa Tengah")
    assert prediction is not None
    # Verify SES prediction is generated
    assert prediction.predicted_price > 0.0
    assert prediction.confidence in (0.90, 0.75, 0.60)
