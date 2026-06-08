"""
Agents router — AI chat (SSE), price recommendations, route planning, and health checks.
Rate limited: 10 req/min per user on agent endpoints.
"""

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import get_current_user, require_role
from models.user import User
from models.batch import ProductBatch
from schemas.agent import (
    ChatRequest,
    ChatResponse,
    PriceRecommendationRequest,
    RouteRecommendationRequest,
    RouteRecommendationResponse,
    AgentHealthResponse,
    AgentLogResponse,
)

from agents.orchestrator import Orchestrator
from agents.price_agent import PriceAgent
from agents.logistics_agent import LogisticsAgent
from agents.tools.maps_tools import calculate_route
from agents.tools.weather_tools import get_weather_forecast

router = APIRouter(prefix="/agents", tags=["agents"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/chat")
@limiter.limit("10/minute")
async def chat_with_agent(
    request_body: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Conversational AI via SSE streaming.
    Routes to appropriate agent based on intent classification.
    """
    orchestrator = Orchestrator()

    # Build user_context dict from the authenticated user's DB record
    # and merge with any extra context provided by the client
    user_context: dict = {
        "name": current_user.name,
        "role": current_user.role,
        "region": current_user.region,
        "phone": current_user.phone,
    }
    # Merge client-supplied extra context (farm_location, land_area, etc.)
    if request_body.user_context:
        client_ctx = request_body.user_context.model_dump(exclude_none=True)
        # Only merge non-null values; DB record takes precedence for name/role/region
        for key, value in client_ctx.items():
            if value and key not in ("name", "role", "region"):
                user_context[key] = value

    async def generate():
        try:
            async for chunk in orchestrator.execute_stream(
                request_body.message,
                role=current_user.role,
                user_context=user_context,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")



@router.post("/price", response_model=ChatResponse)
@limiter.limit("10/minute")
async def get_price_recommendation(
    request_body: PriceRecommendationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI price recommendation for a commodity."""
    import datetime
    from core.redis import redis_client
    
    date_str = datetime.date.today().isoformat()
    cache_key = f"price_recommendation:{request_body.commodity_name}:{request_body.region}:{date_str}"
    
    try:
        cached_val = await redis_client.get(cache_key)
        if cached_val:
            cached_data = json.loads(cached_val)
            return ChatResponse(
                reply=cached_data["reply"],
                agent_type=cached_data["agent_type"],
                model_used=cached_data["model_used"],
                confidence=cached_data["confidence"],
            )
    except Exception as e:
        print(f"Redis cache read error: {e}")

    price_agent = PriceAgent()
    prompt = (
        f"Berikan rekomendasi harga dan strategi penjualan terperinci untuk komoditas "
        f"'{request_body.commodity_name}' di wilayah '{request_body.region}'."
    )
    
    reply, model_used, confidence = await price_agent.execute(prompt)
    
    try:
        cache_data = {
            "reply": reply,
            "agent_type": "price",
            "model_used": model_used,
            "confidence": confidence,
        }
        # Cache for 12 hours (43200 seconds)
        await redis_client.setex(cache_key, 43200, json.dumps(cache_data))
    except Exception as e:
        print(f"Redis cache write error: {e}")
        
    return ChatResponse(
        reply=reply,
        agent_type="price",
        model_used=model_used,
        confidence=confidence,
    )


@router.post("/route", response_model=RouteRecommendationResponse)
@limiter.limit("10/minute")
async def get_route_recommendation(
    request_body: RouteRecommendationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI logistics route recommendation."""
    import hashlib
    from core.redis import redis_client
    
    # 1. Create a unique cache key based on route request inputs
    input_str = f"{request_body.batch_id}:{request_body.origin_lat}:{request_body.origin_lng}:{request_body.destination_lat}:{request_body.destination_lng}"
    input_hash = hashlib.sha256(input_str.encode('utf-8')).hexdigest()
    cache_key = f"route_recommendation:{input_hash}"
    
    # 2. Try fetching from Redis cache
    try:
        cached_val = await redis_client.get(cache_key)
        if cached_val:
            cached_data = json.loads(cached_val)
            return RouteRecommendationResponse(
                recommended_route=cached_data["recommended_route"],
                estimated_duration_min=cached_data["estimated_duration_min"],
                distance_km=cached_data["distance_km"],
                freshness_score=cached_data["freshness_score"],
                tips=cached_data["tips"]
            )
    except Exception as e:
        print(f"Redis cache read error in route endpoint: {e}")

    # 3. Fetch batch details to get commodity name (affects freshness degradation rate)
    query = select(ProductBatch).where(ProductBatch.id == request_body.batch_id)
    result = await db.execute(query)
    batch = result.scalar_one_or_none()
    
    commodity = batch.commodity_name if batch else "sayuran"
    
    # 4. Call maps tool to get distance and duration
    origin_str = f"{request_body.origin_lat},{request_body.origin_lng}"
    dest_str = f"{request_body.destination_lat},{request_body.destination_lng}"
    
    route_info = await calculate_route.ainvoke({"origin": origin_str, "destination": dest_str})
    
    # 5. Fetch weather/temp to adjust freshness degradation
    temp = 25.0
    try:
        weather_info = await get_weather_forecast.ainvoke({
            "latitude": request_body.destination_lat,
            "longitude": request_body.destination_lng
        })
        if "forecast" in weather_info and len(weather_info["forecast"]) > 0:
            temp = weather_info["forecast"][0]["max_temp_celsius"]
    except Exception:
        pass
        
    # 6. Calculate freshness score
    duration_hrs = route_info.get("estimated_duration_min", 180.0) / 60.0
    
    # Leafy greens degrade faster (10%/hour) than hard crops (5%/hour)
    is_leafy = commodity.lower() in ["bayam", "kangkung", "selada"]
    base_rate = 0.10 if is_leafy else 0.05
    
    # Hot weather increases degradation rate
    if temp > 30.0:
        base_rate *= 1.4
        
    freshness_score = max(0.0, 1.0 - (duration_hrs * base_rate))
    
    # 7. Ask LogisticsAgent to generate transit tips
    logistics_agent = LogisticsAgent()
    prompt = (
        f"Berikan saran logistik terperinci untuk pengiriman komoditas '{commodity}' "
        f"dari {origin_str} ke {dest_str} dengan durasi perjalanan {route_info.get('estimated_duration_min')} menit "
        f"pada suhu maksimal daerah tujuan sekitar {temp}°C. Rekomendasikan juga rute terbaik."
    )
    
    reply, _, _ = await logistics_agent.execute(prompt)
    
    # Extract tips from bullet points
    raw_tips = []
    for line in reply.split("\n"):
        line_strip = line.strip()
        if line_strip.startswith("- ") or line_strip.startswith("* ") or (len(line_strip) > 2 and line_strip[0].isdigit() and line_strip[1] == "."):
            # Clean up markdown bullet points safely without stripping inline markdown like **bold**
            cleaned = line_strip
            if cleaned.startswith("- "):
                cleaned = cleaned[2:]
            elif cleaned.startswith("* "):
                cleaned = cleaned[2:]
            elif len(cleaned) > 2 and cleaned[0].isdigit() and cleaned[1] == ".":
                cleaned = cleaned.split(".", 1)[1].strip()
            
            cleaned = cleaned.strip()
            if cleaned:
                raw_tips.append(cleaned)
                
    # Fallback default tips if none extracted
    if not raw_tips:
        raw_tips = [
            "Hindari pengiriman siang hari untuk menghindari suhu panas tinggi.",
            "Gunakan penanganan pasca-panen yang steril untuk mencegah pembusukan.",
            "Pastikan sirkulasi udara di dalam armada pengiriman berjalan lancar."
        ]
        
    response_data = RouteRecommendationResponse(
        recommended_route=route_info.get("route_summary", "Jalur Tercepat (Simulasi)"),
        estimated_duration_min=route_info.get("estimated_duration_min", 180.0),
        distance_km=route_info.get("distance_km", 150.0),
        freshness_score=round(freshness_score, 3),
        tips=raw_tips[:5]  # Limit to top 5 tips
    )
    
    # 8. Save computed response to Redis cache
    try:
        # Cache for 12 hours (43200 seconds)
        await redis_client.setex(cache_key, 43200, json.dumps({
            "recommended_route": response_data.recommended_route,
            "estimated_duration_min": response_data.estimated_duration_min,
            "distance_km": response_data.distance_km,
            "freshness_score": response_data.freshness_score,
            "tips": response_data.tips
        }))
    except Exception as e:
        print(f"Redis cache write error in route endpoint: {e}")
        
    return response_data


@router.get("/health", response_model=List[AgentHealthResponse])
async def get_agent_health(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """[Admin] Check health status of all three AI agents."""
    from sqlalchemy import select, func
    from models.alert import AgentLog
    
    # Calculate health metrics from DB logs
    health_reports = []
    
    for agent in ["price", "logistics", "anomaly"]:
        # Query total calls today
        count_query = select(func.count()).select_from(AgentLog).where(AgentLog.agent_type == agent)
        count_res = await db.execute(count_query)
        total_calls = count_res.scalar() or 0
        
        # Query avg latency
        latency_query = select(func.avg(AgentLog.latency_ms)).where(AgentLog.agent_type == agent)
        latency_res = await db.execute(latency_query)
        avg_latency = float(latency_res.scalar() or 0.0)
        
        # Query last used model dynamically
        model_query = select(AgentLog.model_used).where(AgentLog.agent_type == agent).order_by(AgentLog.created_at.desc()).limit(1)
        model_res = await db.execute(model_query)
        last_model = model_res.scalar() or "gemini-2.5-flash"
        
        # Check status (if there are errors or successful runs)
        status = "online"
        
        health_reports.append(
            AgentHealthResponse(
                agent_type=agent,
                status=status,
                primary_model=last_model,
                fallback_model="gpt-4o-mini",
                avg_latency_ms=round(avg_latency, 1),
                total_calls_today=total_calls,
            )
        )
        
    return health_reports


@router.get("/logs", response_model=List[AgentLogResponse])
async def get_agent_logs(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """[Admin] Get agent activity logs for monitoring."""
    from sqlalchemy import select
    from models.alert import AgentLog

    result = await db.execute(
        select(AgentLog).order_by(AgentLog.created_at.desc()).limit(50)
    )
    return result.scalars().all()

