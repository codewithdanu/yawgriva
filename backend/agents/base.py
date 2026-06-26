"""
Base AI Agent implementation.
Handles primary LLM (Gemini 2.5 Flash) with fallback LLM (GPT-4o-mini),
tool calling loop, and database audit logs.
"""

import time
import hashlib
from typing import List, Dict, Any, Tuple
from sqlalchemy import insert

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from core.config import settings
from core.database import async_session
from models.alert import AgentLog


async def get_main_ai_model() -> str:
    """Helper to fetch the configured main AI model from Redis."""
    from core.redis import redis_client
    try:
        model = await redis_client.get("config:main_ai_model")
        if model in ("gemini", "openai"):
            return model
    except Exception as e:
        print(f"Failed to read main AI model from Redis: {e}")
    return "gemini"


class BaseAgent:
    def __init__(self, agent_type: str, system_prompt: str, tools: List[Any] = None):
        self.agent_type = agent_type
        self.system_prompt = system_prompt
        self.tools = tools or []
        self.tools_map = {t.name: t for t in self.tools}

    def _get_gemini_llm(self, model_name: str):
        """Get Gemini LLM instance for a specific model name."""
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.2,
            max_retries=1
        )

    def _get_fallback_llm(self):
        """Get GPT-4o-mini fallback LLM."""
        return ChatOpenAI(
            model="gpt-4o-mini",
            api_key=settings.OPENAI_API_KEY,
            temperature=0.2,
            max_retries=1
        )

    async def execute(self, user_message: str, context_suffix: str = "") -> Tuple[str, str, float]:
        """
        Execute the agent with the user message, handling tool calls and fallbacks.
        Returns:
            Tuple[reply_text, model_used, confidence]
        """
        start_time = time.time()
        input_hash = hashlib.sha256(user_message.encode('utf-8')).hexdigest()
        
        effective_prompt = self.system_prompt + context_suffix
        
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
        
        messages = [
            SystemMessage(content=effective_prompt),
            HumanMessage(content=user_message)
        ]
        
        model_used = "failed"
        tokens_used = 0
        current_model_idx = 0
        max_iterations = 5
        reply = ""
        
        for iteration in range(max_iterations):
            response = None
            
            # Find a working model for this invocation
            while current_model_idx < len(models_to_try):
                provider, model_name = models_to_try[current_model_idx]
                try:
                    if provider == "gemini":
                        llm = self._get_gemini_llm(model_name)
                    else:
                        llm = self._get_fallback_llm()
                        
                    if self.tools:
                        model = llm.bind_tools(self.tools)
                    else:
                        model = llm
                    
                    response = await model.ainvoke(messages)
                    model_used = model_name
                    break
                except Exception as e:
                    print(f"Model {provider}/{model_name} failed during invocation (iteration {iteration}): {e}. Trying next model...")
                    current_model_idx += 1
            
            if response is None:
                print("All available models failed.")
                reply = "Maaf, sistem AI sedang mengalami gangguan koneksi. Silakan coba beberapa saat lagi."
                model_used = "failed"
                break
            
            messages.append(response)
            if hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                tokens_used += response.response_metadata["token_usage"].get("total_tokens", 0)
                
            if hasattr(response, "tool_calls") and response.tool_calls:
                for tool_call in response.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call.get("id", str(time.time()))
                    
                    if tool_name in self.tools_map:
                        tool_func = self.tools_map[tool_name]
                        try:
                            tool_result = await tool_func.ainvoke(tool_args)
                            tool_result_str = str(tool_result)
                        except Exception as e:
                            tool_result_str = f"Error executing tool {tool_name}: {str(e)}"
                            
                        messages.append(ToolMessage(
                            content=tool_result_str,
                            tool_call_id=tool_id,
                            name=tool_name
                        ))
                    else:
                        messages.append(ToolMessage(
                            content=f"Tool '{tool_name}' not found.",
                            tool_call_id=tool_id,
                            name=tool_name
                        ))
                continue
            else:
                reply = response.content
                break
        else:
            reply = messages[-1].content
            
        latency_ms = int((time.time() - start_time) * 1000)
        
        await self._log_execution(
            agent_type=self.agent_type,
            input_hash=input_hash,
            output_summary=reply,
            tokens_used=tokens_used,
            latency_ms=latency_ms,
            model_used=model_used
        )
        
        confidence = 0.85 if model_used != "failed" else 0.0
        return reply, model_used, confidence

    async def execute_stream(self, user_message: str, context_suffix: str = ""):
        """
        Execute the agent and yield SSE data frames:
        - {"status": "Membaca database..."} when calling tools
        - {"chunk": "teks..."} for final answer text
        - {"done": True, "model": model_used, "confidence": confidence} at the end
        """
        import asyncio
        start_time = time.time()
        input_hash = hashlib.sha256(user_message.encode('utf-8')).hexdigest()
        
        effective_prompt = self.system_prompt + context_suffix
        
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

        messages = [
            SystemMessage(content=effective_prompt),
            HumanMessage(content=user_message)
        ]
        
        model_used = "failed"
        tokens_used = 0
        current_model_idx = 0
        max_iterations = 5
        reply = ""
        
        for iteration in range(max_iterations):
            response = None
            
            # Find a working model for this invocation
            while current_model_idx < len(models_to_try):
                provider, model_name = models_to_try[current_model_idx]
                try:
                    if provider == "gemini":
                        llm = self._get_gemini_llm(model_name)
                    else:
                        llm = self._get_fallback_llm()
                        
                    if self.tools:
                        model = llm.bind_tools(self.tools)
                    else:
                        model = llm
                    
                    response = await model.ainvoke(messages)
                    model_used = model_name
                    break
                except Exception as e:
                    print(f"Model {provider}/{model_name} streaming failed during invocation (iteration {iteration}): {e}. Trying next model...")
                    next_model_name = models_to_try[current_model_idx+1][1] if current_model_idx+1 < len(models_to_try) else "none"
                    yield {"status": f"Mengalihkan ke model alternatif ({next_model_name})..."}
                    current_model_idx += 1
            
            if response is None:
                print("All available models failed.")
                yield {"status": "Semua model gagal merespon..."}
                reply = "Maaf, sistem AI sedang mengalami gangguan koneksi. Silakan coba beberapa saat lagi."
                model_used = "failed"
                break
            
            messages.append(response)
            if hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                tokens_used += response.response_metadata["token_usage"].get("total_tokens", 0)
                
            if hasattr(response, "tool_calls") and response.tool_calls:
                for tool_call in response.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call.get("id", str(time.time()))
                    
                    yield {"status": f"Menggunakan alat: {tool_name}..."}
                    
                    if tool_name in self.tools_map:
                        tool_func = self.tools_map[tool_name]
                        try:
                            tool_result = await tool_func.ainvoke(tool_args)
                            tool_result_str = str(tool_result)
                        except Exception as e:
                            tool_result_str = f"Error executing tool {tool_name}: {str(e)}"
                            
                        messages.append(ToolMessage(
                            content=tool_result_str,
                            tool_call_id=tool_id,
                            name=tool_name
                        ))
                    else:
                        messages.append(ToolMessage(
                            content=f"Tool '{tool_name}' not found.",
                            tool_call_id=tool_id,
                            name=tool_name
                        ))
                continue
            else:
                reply = response.content
                break
        else:
            reply = messages[-1].content
            
        # Stream the reply text to client in small chunks
        words = reply.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield {"chunk": chunk}
            await asyncio.sleep(0.02)
            
        latency_ms = int((time.time() - start_time) * 1000)
        
        await self._log_execution(
            agent_type=self.agent_type,
            input_hash=input_hash,
            output_summary=reply,
            tokens_used=tokens_used,
            latency_ms=latency_ms,
            model_used=model_used
        )
        
        confidence = 0.85 if model_used != "failed" else 0.0
        yield {"done": True, "model": model_used, "confidence": confidence}

    async def _log_execution(
        self,
        agent_type: str,
        input_hash: str,
        output_summary: str,
        tokens_used: int | None,
        latency_ms: int,
        model_used: str
    ):
        """Write audit log record to Database."""
        async with async_session() as session:
            try:
                log_entry = AgentLog(
                    agent_type=agent_type,
                    input_hash=input_hash,
                    output_summary=output_summary,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms,
                    model_used=model_used
                )
                session.add(log_entry)
                await session.commit()
            except Exception as e:
                print(f"Error saving agent log: {e}")
                await session.rollback()

