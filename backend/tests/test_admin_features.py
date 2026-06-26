"""
Unit tests for new Admin dashboard features (User Verification & Outlier validation).
Uses mock sessions and FastAPIs TestClient.
"""

import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

# Mock database module before imports to avoid DB connection attempts
with patch("core.database.async_session") as mock_session:
    from main import app
    from models.user import User
    from models.community_price import CommunityPriceReport

client = TestClient(app)

@pytest.fixture
def mock_admin_auth():
    mock_user = MagicMock(spec=User)
    mock_user.id = uuid.uuid4()
    mock_user.role = "admin"
    mock_user.name = "Mock Admin"
    mock_user.email = "admin@yawgriva.com"
    mock_user.is_verified = True
    mock_user.created_at = datetime.now(timezone.utc)
    
    from core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    with patch("core.security.get_current_user", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_user
        yield
        
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_db_session():
    from core.database import get_db
    mock_db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_admin_verify_user(mock_admin_auth, mock_db_session):
    user_id = uuid.uuid4()
    mock_user = User(
        id=user_id,
        name="Test Farmer",
        email="farmer@test.com",
        role="farmer",
        is_verified=False,
        created_at=datetime.now(timezone.utc)
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_db_session.execute.return_value = mock_result
    
    response = client.patch(
        f"/api/v1/admin/users/{user_id}/verify?verified=true",
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_verified"] is True
    assert mock_user.is_verified is True
    mock_db_session.commit.assert_called_once()


@pytest.mark.anyio
async def test_admin_list_outliers(mock_admin_auth, mock_db_session):
    report_id = uuid.uuid4()
    mock_report = CommunityPriceReport(
        id=report_id,
        commodity_name="cabai_merah",
        price_per_kg=150000.0,
        market_name="Pasar Test",
        region="Jawa",
        transaction_type="pasar",
        status="suspect",
        reporter_weight=1.0,
        reported_at=datetime.now(timezone.utc)
    )
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_report]
    mock_db_session.execute.return_value = mock_result
    
    response = client.get(
        "/api/v1/admin/outliers",
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["commodity_name"] == "cabai_merah"
    assert data[0]["status"] == "suspect"


@pytest.mark.anyio
async def test_admin_validate_outlier(mock_admin_auth, mock_db_session):
    report_id = uuid.uuid4()
    mock_report = CommunityPriceReport(
        id=report_id,
        commodity_name="cabai_merah",
        price_per_kg=150000.0,
        market_name="Pasar Test",
        region="Jawa",
        transaction_type="pasar",
        status="suspect",
        reporter_weight=1.0,
        reported_at=datetime.now(timezone.utc)
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_report
    mock_db_session.execute.return_value = mock_result
    
    response = client.patch(
        f"/api/v1/admin/outliers/{report_id}/validate",
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "validated"
    assert mock_report.status == "validated"
    mock_db_session.commit.assert_called_once()


@pytest.mark.anyio
async def test_admin_reject_outlier(mock_admin_auth, mock_db_session):
    report_id = uuid.uuid4()
    mock_report = CommunityPriceReport(
        id=report_id,
        commodity_name="cabai_merah",
        price_per_kg=150000.0,
        market_name="Pasar Test",
        region="Jawa",
        transaction_type="pasar",
        status="suspect",
        reporter_weight=1.0,
        reported_at=datetime.now(timezone.utc)
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_report
    mock_db_session.execute.return_value = mock_result
    
    response = client.patch(
        f"/api/v1/admin/outliers/{report_id}/reject",
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert mock_report.status == "rejected"
    mock_db_session.commit.assert_called_once()


@pytest.mark.anyio
async def test_update_profile(mock_admin_auth, mock_db_session):
    user_id = uuid.uuid4()
    mock_user = User(
        id=user_id,
        name="Mock Admin",
        email="admin@yawgriva.com",
        role="admin",
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        farmer_profile=None
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = mock_user
    mock_db_session.execute.return_value = mock_result
    
    response = client.put(
        "/api/v1/auth/profile",
        json={"name": "New Admin Name", "phone": "081234567890", "region": "Bali"},
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Admin Name"
    assert data["phone"] == "081234567890"
    assert data["region"] == "Bali"
    mock_db_session.commit.assert_called_once()


@pytest.mark.anyio
async def test_list_batches_with_distributor_properties(mock_admin_auth, mock_db_session):
    from datetime import date
    from models.delivery_request import DeliveryRequest
    from models.batch import ProductBatch
    
    # Mock user as a farmer
    mock_user = MagicMock(spec=User)
    mock_user.id = uuid.uuid4()
    mock_user.role = "farmer"
    mock_user.name = "Test Farmer"
    mock_user.email = "farmer@test.com"
    mock_user.is_verified = True
    mock_user.created_at = datetime.now(timezone.utc)
    
    # Mock batch
    batch_id = uuid.uuid4()
    mock_batch = ProductBatch(
        id=batch_id,
        farmer_id=mock_user.id,
        commodity_name="tomat",
        quantity_kg=200.0,
        harvest_date=date(2026, 5, 30),
        qr_code_hash="test-qr-hash",
        status="in_transit",
        created_at=datetime.now(timezone.utc),
        checkpoints=[]
    )
    
    # Mock distributor
    mock_distributor = User(
        id=uuid.uuid4(),
        name="Mock Distributor",
        role="distributor"
    )
    # Mock delivery request accepted
    mock_request = DeliveryRequest(
        id=uuid.uuid4(),
        batch_id=batch_id,
        distributor_id=mock_distributor.id,
        match_score=95.5,
        status="accepted",
        distributor=mock_distributor
    )
    
    mock_batch.delivery_requests = [mock_request]
    
    # Ensure they are in the __dict__ to simulate selectinload
    mock_batch.__dict__["delivery_requests"] = [mock_request]
    mock_request.__dict__["distributor"] = mock_distributor
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_batch]
    mock_db_session.execute.return_value = mock_result
    
    from core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    response = client.get(
        "/api/v1/batches",
        headers={"Authorization": "Bearer mock-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["commodity_name"] == "tomat"
    assert data[0]["distributor_name"] == "Mock Distributor"
    assert data[0]["match_score"] == 95.5


@pytest.mark.anyio
@patch("core.redis.redis_client", new_callable=AsyncMock)
async def test_admin_ai_model_setting(mock_redis, mock_admin_auth):
    # Mock redis get/set
    mock_redis.get.return_value = "openai"
    mock_redis.set = AsyncMock()

    # Test GET
    response = client.get(
        "/api/v1/admin/ai-model",
        headers={"Authorization": "Bearer mock-token"}
    )
    assert response.status_code == 200
    assert response.json()["main_model"] == "openai"
    mock_redis.get.assert_called_once_with("config:main_ai_model")

    # Test POST
    response = client.post(
        "/api/v1/admin/ai-model",
        json={"main_model": "gemini"},
        headers={"Authorization": "Bearer mock-token"}
    )
    assert response.status_code == 200
    assert response.json()["main_model"] == "gemini"
    mock_redis.set.assert_called_once_with("config:main_ai_model", "gemini")


