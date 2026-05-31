import json
from pathlib import Path
from typing import Any

import httpx
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    CropCampaign,
    IrrigationRecommendation,
    Plot,
    Producer,
    SeedAnalysisResult,
    WeatherSnapshot,
)

SEED_CONTEXT_PATH = Path(__file__).resolve().parents[1] / "data" / "kf001_seed_verifier_context.json"


def _load_seed_verifier_contexts() -> list[dict[str, Any]]:
    if not SEED_CONTEXT_PATH.exists():
        return []
    with SEED_CONTEXT_PATH.open("r", encoding="utf-8") as file:
        return [json.load(file)]


def build_agent_runtime_context(db: Session) -> dict[str, Any]:
    producers = db.execute(select(Producer).order_by(Producer.created_at.desc()).limit(8)).scalars().all()
    plots = db.execute(select(Plot).order_by(Plot.created_at.desc()).limit(12)).scalars().all()
    campaigns = db.execute(select(CropCampaign).order_by(CropCampaign.created_at.desc()).limit(12)).scalars().all()
    weather = db.execute(select(WeatherSnapshot).order_by(WeatherSnapshot.created_at.desc()).limit(8)).scalars().all()
    seed_results = db.execute(select(SeedAnalysisResult).order_by(SeedAnalysisResult.created_at.desc()).limit(8)).scalars().all()
    irrigation = db.execute(select(IrrigationRecommendation).order_by(IrrigationRecommendation.created_at.desc()).limit(8)).scalars().all()

    return jsonable_encoder(
        {
            "product": {
                "name": "NEXO",
                "domain": "AgTech para riego inteligente, analisis de semillas y recomendaciones FAO-56.",
                "current_flow": [
                    "El cliente registra o selecciona parcelas.",
                    "El sistema calcula riego con ETc = Kc * ET0.",
                    "La calidad SeedDSS ajusta el Kc inicial y la recomendacion.",
                    "El clima y lluvia efectiva alimentan la decision de riego.",
                ],
            },
            "producers": producers,
            "plots": plots,
            "campaigns": campaigns,
            "weather_snapshots": weather,
            "seed_analysis_results": seed_results,
            "seed_verifier_external_contexts": _load_seed_verifier_contexts(),
            "irrigation_recommendations": irrigation,
        }
    )


def _history_to_contents(history: list[dict[str, str]]) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for item in history[-10:]:
        role = item.get("role", "user")
        if role == "assistant":
            role = "model"
        if role not in {"user", "model"}:
            role = "user"
        content = item.get("content", "").strip()
        if content:
            contents.append({"role": role, "parts": [{"text": content}]})
    return contents


async def ask_gemini(message: str, history: list[dict[str, str]], context: dict[str, Any] | None = None) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY no esta configurada.")

    context_text = jsonable_encoder(context or {})
    system_prompt = (
        "Eres el asistente tecnico de NEXO, una plataforma AgTech para productores de soya. "
        "Responde en espanol, con tono claro y accionable. Usa los datos de contexto cuando existan. "
        "Si el usuario pregunta por KF001, Karen, o sus semillas, prioriza el objeto "
        "seed_verifier_external_contexts. Si falta informacion, dilo y sugiere que dato registrar. "
        "No inventes metricas exactas."
    )
    user_prompt = (
        "Contexto disponible del sistema NEXO:\n"
        f"{context_text}\n\n"
        "Pregunta del usuario:\n"
        f"{message}"
    )

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [
            *_history_to_contents(history),
            {"role": "user", "parts": [{"text": user_prompt}]},
        ],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 900,
        },
    }

    url = f"{settings.gemini_api_url.rstrip('/')}/models/{settings.gemini_model}:generateContent"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.gemini_api_key,
            },
            json=payload,
        )
        response.raise_for_status()

    data = response.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    answer = "".join(part.get("text", "") for part in parts).strip()
    return answer or "Gemini no devolvio una respuesta de texto."
