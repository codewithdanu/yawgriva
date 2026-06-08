"""
Unit tests for AI agents (Price, Logistics, Anomaly, Orchestrator)
and tool binding logic. Mocking LLM calls for database-independent validation.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage

# Mock database module before imports to avoid DB connection attempts
with patch("core.database.async_session") as mock_session:
    from agents.base import BaseAgent
    from agents.price_agent import PriceAgent
    from agents.logistics_agent import LogisticsAgent
    from agents.anomaly_agent import AnomalyAgent
    from agents.orchestrator import Orchestrator


@pytest.mark.asyncio
async def test_orchestrator_classification():
    """Test that the orchestrator classifies intents correctly using mock LLM."""
    orch = Orchestrator()
    
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.content = "price"
    
    with patch.object(orch, "_get_gemini_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        mock_get_llm.return_value = mock_llm
        
        intent = await orch.classify_intent("Berapa harga cabai keriting?")
        assert intent == "price"
        mock_llm.ainvoke.assert_called_once()


@pytest.mark.asyncio
@patch("agents.base.async_session")
async def test_agent_execution_with_fallback(mock_session):
    """Test that the base agent falls back to OpenAI if Gemini fails."""
    # Mock database log insert
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_session.return_value.__aenter__.return_value = mock_db
    
    agent = BaseAgent(
        agent_type="price",
        system_prompt="Test Prompt"
    )
    
    # Mock Gemini failing
    mock_gemini = MagicMock()
    mock_gemini.bind_tools = MagicMock(return_value=mock_gemini)
    mock_gemini.ainvoke = AsyncMock(side_effect=Exception("Gemini Service Unavailable"))
    
    # Mock OpenAI succeeding
    mock_openai_response = MagicMock()
    mock_openai_response.content = "OpenAI response"
    mock_openai = MagicMock()
    mock_openai.ainvoke = AsyncMock(return_value=mock_openai_response)
    
    with patch.object(agent, "_get_gemini_llm", return_value=mock_gemini), \
         patch.object(agent, "_get_fallback_llm", return_value=mock_openai):
         
        reply, model, confidence = await agent.execute("Hello")
        
        assert reply == "OpenAI response"
        assert model == "gpt-4o-mini"
        assert confidence == 0.85


@pytest.mark.asyncio
@patch("agents.base.async_session")
async def test_price_agent_tool_calling(mock_session):
    """Test that the Price Agent correctly requests and executes a tool call."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_session.return_value.__aenter__.return_value = mock_db
    
    agent = PriceAgent()
    
    # Mock the tool call from LLM response
    # First response asks to call fetch_latest_prices
    tool_call = {
        "name": "fetch_latest_prices",
        "args": {"commodity_name": "cabai_merah"},
        "id": "call_123"
    }
    
    first_response = MagicMock()
    first_response.tool_calls = [tool_call]
    # Set return_value of response_metadata for token count extraction
    first_response.response_metadata = {"token_usage": {"total_tokens": 150}}
    
    # Second response gives the final text
    second_response = MagicMock()
    second_response.tool_calls = []
    second_response.content = "Harga cabai merah stabil di Rp 45.000."
    second_response.response_metadata = {"token_usage": {"total_tokens": 50}}
    
    mock_gemini = MagicMock()
    mock_gemini.bind_tools = MagicMock(return_value=mock_gemini)
    mock_gemini.ainvoke = AsyncMock(side_effect=[first_response, second_response])
    
    # Mock fetch_latest_prices tool execution
    mock_tool = MagicMock()
    mock_tool.ainvoke = AsyncMock(return_value=[{"price_per_kg": 45000}])
    agent.tools_map["fetch_latest_prices"] = mock_tool
    
    with patch.object(agent, "_get_gemini_llm", return_value=mock_gemini):
         
        reply, model, confidence = await agent.execute("Berapa harga cabai?")
        
        assert reply == "Harga cabai merah stabil di Rp 45.000."
        assert model == "gemini-2.5-flash"
        assert mock_gemini.ainvoke.call_count == 2
        mock_tool.ainvoke.assert_called_once_with({"commodity_name": "cabai_merah"})

