import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import status
from fastapi.testclient import TestClient

from models.user import User
from models.batch import ProductBatch
from models.checkpoint import DistributionCheckpoint
from services.vision_service import VisualAnalysisResult
from workers.vision_worker import _analyze_checkpoint_photo


@pytest.fixture
def mock_checkpoint_data():
    checkpoint_id = uuid.uuid4()
    batch_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    user = User(
        id=user_id,
        name="Test Distributor",
        email="distributor@test.com",
        role="distributor",
        is_verified=True,
    )
    
    batch = ProductBatch(
        id=batch_id,
        farmer_id=uuid.uuid4(),
        commodity_name="tomat",
        quantity_kg=100.0,
        status="in_transit",
    )
    
    checkpoint = DistributionCheckpoint(
        id=checkpoint_id,
        batch_id=batch_id,
        scanned_by=user_id,
        location_name="Check Point 1",
        temp_celsius=25.0,
    )
    return {
        "checkpoint": checkpoint,
        "batch": batch,
        "user": user
    }


@pytest.mark.anyio
@patch("services.storage_service.storage_service.upload_file")
@patch("workers.vision_worker.analyze_checkpoint_photo_task.delay")
async def test_upload_checkpoint_photo_async_flow(
    mock_delay, mock_upload_file, mock_checkpoint_data
):
    # This is a unit test for checkpoints photo upload router
    from main import app
    from routers.checkpoints import upload_checkpoint_photo
    
    mock_upload_file.return_value = "http://localhost:9000/checkpoint-photos/checkpoints/test.jpg"
    
    # We will test the routing by calling the function directly or using test client with dependency overrides
    # For simplicity, let's call the router helper logic or mock DB
    db_session = AsyncMock()
    
    # Mock database responses
    # 1. Verify checkpoint exists
    # 2. Count existing photos
    # 3. Get commodity for context
    db_session.execute = AsyncMock()
    
    # We construct mock scalar returns
    mock_execute_result_cp = MagicMock()
    mock_execute_result_cp.scalar_one_or_none.return_value = mock_checkpoint_data["checkpoint"]
    
    mock_execute_result_count = MagicMock()
    mock_execute_result_count.scalars.return_value.all.return_value = []
    
    mock_execute_result_batch = MagicMock()
    mock_execute_result_batch.scalar_one_or_none.return_value = mock_checkpoint_data["batch"]
    
    db_session.execute.side_effect = [
        mock_execute_result_cp,
        mock_execute_result_count,
        mock_execute_result_batch
    ]
    
    photo_file = MagicMock()
    photo_file.filename = "test.jpg"
    photo_file.content_type = "image/jpeg"
    photo_file.read = AsyncMock(return_value=b"fake_image_bytes")
    
    res = await upload_checkpoint_photo(
        checkpoint_id=mock_checkpoint_data["checkpoint"].id,
        photo=photo_file,
        current_user=mock_checkpoint_data["user"],
        db=db_session
    )
    
    # Assertions
    assert res.photo_url == "http://localhost:9000/checkpoint-photos/checkpoints/test.jpg"
    assert res.visual_condition is None
    assert res.visual_summary == "Sedang menganalisis foto..."
    
    # Check that MinIO upload was called
    mock_upload_file.assert_called_once()
    
    # Check that celery task was triggered
    mock_delay.assert_called_once_with(
        str(mock_checkpoint_data["checkpoint"].id),
        f"checkpoints/{mock_checkpoint_data['checkpoint'].id}/test.jpg",
        "tomat"
    )


@pytest.mark.anyio
@patch("services.storage_service.storage_service.get_file")
@patch("workers.vision_worker.analyze_product_photo")
@patch("workers.vision_worker.async_session_factory")
async def test_celery_vision_task_logic(
    mock_async_session, mock_analyze, mock_get_file, mock_checkpoint_data
):
    mock_get_file.return_value = b"fake_image_bytes"
    
    mock_analyze.return_value = VisualAnalysisResult(
        condition="excellent",
        condition_id="Sangat Baik",
        issues=[],
        confidence=0.95,
        summary="Kondisi tomat sangat prima."
    )
    
    # Setup mock DB session
    mock_db = AsyncMock()
    mock_async_session.return_value.__aenter__.return_value = mock_db
    
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = mock_checkpoint_data["checkpoint"]
    mock_db.execute.return_value = mock_execute_result
    
    checkpoint_id_str = str(mock_checkpoint_data["checkpoint"].id)
    storage_key = "checkpoints/test.jpg"
    
    await _analyze_checkpoint_photo(checkpoint_id_str, storage_key, "tomat")
    
    # Assert get_file called with the correct key
    mock_get_file.assert_called_once_with(storage_key)
    
    # Assert analyze_product_photo called with the correct bytes
    mock_analyze.assert_called_once_with(b"fake_image_bytes", "tomat")
    
    # Assert DB checkpoint was updated
    assert mock_checkpoint_data["checkpoint"].visual_condition == "excellent"
    assert mock_checkpoint_data["checkpoint"].visual_summary == "Kondisi tomat sangat prima."
    assert mock_checkpoint_data["checkpoint"].visual_confidence == 0.95
    
    # Assert DB was committed

@pytest.mark.anyio
@patch("services.vision_service.AsyncOpenAI")
@patch("google.generativeai.GenerativeModel")
async def test_openai_fallback_on_gemini_failure(mock_gemini_model, mock_openai_client):
    from services.vision_service import analyze_product_photo
    
    # 1. Mock Gemini throwing an exception (e.g. rate limit 429)
    mock_model_instance = MagicMock()
    mock_model_instance.generate_content.side_effect = Exception("429 ResourceExhausted")
    mock_gemini_model.return_value = mock_model_instance
    
    # 2. Mock OpenAI succeeding
    mock_chat_completion = MagicMock()
    mock_message = MagicMock()
    mock_message.content = '{"condition": "good", "condition_id": "Baik", "issues": [], "confidence": 0.8, "summary": "Kondisi tomat baik (OpenAI)."}'
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_chat_completion.choices = [mock_choice]
    
    mock_completions = MagicMock()
    mock_completions.create = AsyncMock(return_value=mock_chat_completion)
    
    mock_client_instance = MagicMock()
    mock_client_instance.chat = MagicMock()
    mock_client_instance.chat.completions = mock_completions
    mock_openai_client.return_value = mock_client_instance
    
    # Patch config to make sure OPENAI_API_KEY is present
    with patch("core.config.settings.OPENAI_API_KEY", "fake-openai-key"):
        result = await analyze_product_photo(b"fake_image_bytes", "tomat")
        
    assert result.condition == "good"
    assert result.condition_id == "Baik"
    assert "OpenAI" in result.summary
    assert result.confidence == 0.8
