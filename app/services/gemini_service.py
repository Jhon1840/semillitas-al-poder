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
    CropCoefficient,
    IrrigationRecommendation,
    Plot,
    Producer,
    SeedAnalysisResult,
    SeedSample,
    WeatherSnapshot,
)

SEED_CONTEXT_PATH = Path(__file__).resolve().parents[1] / "data" / "kf001_seed_verifier_context.json"


def _load_seed_verifier_contexts() -> list[dict[str, Any]]:
    if not SEED_CONTEXT_PATH.exists():
        return []
    with SEED_CONTEXT_PATH.open("r", encoding="utf-8") as file:
        return [json.load(file)]


def _to_float(value: Any, fallback: float = 0) -> float:
    try:
        if value is None:
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _estimate_et0(weather: WeatherSnapshot | None) -> float:
    if not weather:
        return 0

    tmax = _to_float(weather.tmax_c, 28)
    tmin = _to_float(weather.tmin_c, 18)
    tmean = _to_float(weather.tmean_c, (tmax + tmin) / 2)
    wind = _to_float(weather.wind_speed_ms, 1.5)
    humidity = _to_float(weather.humidity_percent, 60)
    solar = _to_float(weather.solar_radiation_estimate, 0)

    if solar > 0:
        radiation_component = 0.408 * 0.72 * solar
        climate_factor = 1 + max(-0.12, min(0.18, (wind - 2) * 0.04 - (humidity - 60) * 0.002))
        return max(0, radiation_component * climate_factor)

    temperature_range = max(0.1, tmax - tmin)
    return max(0, 0.0023 * (tmean + 17.8) * (temperature_range**0.5) * 16)


def _seed_quality_factor(score: float | None) -> float:
    if score is None:
        return 1
    return max(0.92, min(1.08, 1 + (score - 85) / 1000))


def _build_irrigation_fao_context(
    plots: list[Plot],
    campaigns: list[CropCampaign],
    weather: list[WeatherSnapshot],
    seed_results: list[SeedAnalysisResult],
    seed_samples: list[SeedSample],
    crop_coefficients: list[CropCoefficient],
) -> list[dict[str, Any]]:
    weather_by_plot: dict[str, WeatherSnapshot] = {}
    for snapshot in weather:
        if snapshot.plot_id and str(snapshot.plot_id) not in weather_by_plot:
            weather_by_plot[str(snapshot.plot_id)] = snapshot

    samples_by_campaign: dict[str, list[SeedSample]] = {}
    for sample in seed_samples:
        samples_by_campaign.setdefault(str(sample.crop_campaign_id), []).append(sample)

    results_by_sample: dict[str, list[SeedAnalysisResult]] = {}
    for result in seed_results:
        results_by_sample.setdefault(str(result.seed_sample_id), []).append(result)

    kc_by_crop_stage = {
        (coefficient.crop_type, coefficient.stage): _to_float(coefficient.kc_value, 0.8)
        for coefficient in crop_coefficients
    }

    plot_by_id = {str(plot.id): plot for plot in plots}
    contexts: list[dict[str, Any]] = []
    plots_with_campaign_context: set[str] = set()

    for campaign in campaigns:
        plot = plot_by_id.get(str(campaign.plot_id))
        if not plot:
            continue
        plots_with_campaign_context.add(str(plot.id))

        latest_weather = weather_by_plot.get(str(plot.id))
        campaign_samples = samples_by_campaign.get(str(campaign.id), [])
        latest_sample = campaign_samples[0] if campaign_samples else None
        latest_seed_result = None
        if latest_sample:
            sample_results = results_by_sample.get(str(latest_sample.id), [])
            latest_seed_result = sample_results[0] if sample_results else None

        seed_quality = _to_float(
            latest_seed_result.quality_score if latest_seed_result else campaign.seed_quality_score,
            85,
        )
        kc_base = kc_by_crop_stage.get((campaign.crop_type, campaign.current_stage), 0.8)
        seed_factor = _seed_quality_factor(seed_quality)
        kc_adjusted = kc_base * seed_factor
        et0 = _estimate_et0(latest_weather)
        etc = et0 * kc_adjusted
        effective_rain = _to_float(latest_weather.precipitation_mm if latest_weather else None, 0) * 0.8
        water_deficit = max(0, etc - effective_rain)
        area_m2 = _to_float(plot.area_m2, _to_float(plot.area_ha, 1) * 10000)
        recommended_liters_today = water_deficit * area_m2

        contexts.append(
            {
                "plot": {
                    "id": plot.id,
                    "name": plot.name,
                    "code": plot.code,
                    "area_m2": plot.area_m2,
                    "area_ha": plot.area_ha,
                    "centroid_latitude": plot.centroid_latitude,
                    "centroid_longitude": plot.centroid_longitude,
                    "irrigation_method": plot.irrigation_method,
                },
                "campaign": {
                    "id": campaign.id,
                    "name": campaign.name,
                    "crop_type": campaign.crop_type,
                    "variety": campaign.variety,
                    "current_stage": campaign.current_stage,
                    "seed_quality_score": campaign.seed_quality_score,
                    "seed_quality_category": campaign.seed_quality_category,
                },
                "seed_lot": {
                    "sample_id": latest_sample.id if latest_sample else None,
                    "sample_code": latest_sample.sample_code if latest_sample else None,
                    "seed_lot_code": latest_sample.seed_lot_code if latest_sample else None,
                    "seed_type": latest_sample.seed_type if latest_sample else None,
                },
                "seed_analysis": {
                    "result_id": latest_seed_result.id if latest_seed_result else None,
                    "quality_score": latest_seed_result.quality_score if latest_seed_result else None,
                    "purity_score": latest_seed_result.purity_score if latest_seed_result else None,
                    "germination_estimate": latest_seed_result.germination_estimate if latest_seed_result else None,
                    "confidence_score": latest_seed_result.confidence_score if latest_seed_result else None,
                    "recommendation": latest_seed_result.recommendation if latest_seed_result else None,
                },
                "weather": {
                    "snapshot_id": latest_weather.id if latest_weather else None,
                    "provider": latest_weather.provider if latest_weather else None,
                    "tmean_c": latest_weather.tmean_c if latest_weather else None,
                    "tmax_c": latest_weather.tmax_c if latest_weather else None,
                    "precipitation_mm": latest_weather.precipitation_mm if latest_weather else None,
                    "humidity_percent": latest_weather.humidity_percent if latest_weather else None,
                    "wind_speed_ms": latest_weather.wind_speed_ms if latest_weather else None,
                    "solar_radiation_estimate": latest_weather.solar_radiation_estimate if latest_weather else None,
                },
                "fao56_estimate": {
                    "formula": "ETc = Kc ajustado * ET0; deficit = max(ETc - lluvia efectiva, 0); litros = deficit_mm * area_m2",
                    "kc_base": round(kc_base, 3),
                    "seed_quality_factor": round(seed_factor, 3),
                    "kc_adjusted": round(kc_adjusted, 3),
                    "et0_mm_day": round(et0, 2),
                    "etc_mm_day": round(etc, 2),
                    "effective_rain_mm": round(effective_rain, 2),
                    "water_deficit_mm_day": round(water_deficit, 2),
                    "recommended_liters_today": round(recommended_liters_today, 2),
                    "recommended_m3_today": round(recommended_liters_today / 1000, 2),
                    "method_note": "Estimacion operativa para asistente; si falta radiacion se usa aproximacion por temperatura.",
                },
            }
        )

    for plot in plots:
        if str(plot.id) in plots_with_campaign_context:
            continue

        latest_weather = weather_by_plot.get(str(plot.id))
        kc_base = 0.8
        seed_factor = 1
        kc_adjusted = kc_base * seed_factor
        et0 = _estimate_et0(latest_weather)
        etc = et0 * kc_adjusted
        effective_rain = _to_float(latest_weather.precipitation_mm if latest_weather else None, 0) * 0.8
        water_deficit = max(0, etc - effective_rain)
        area_m2 = _to_float(plot.area_m2, _to_float(plot.area_ha, 1) * 10000)
        recommended_liters_today = water_deficit * area_m2

        contexts.append(
            {
                "plot": {
                    "id": plot.id,
                    "name": plot.name,
                    "code": plot.code,
                    "area_m2": plot.area_m2,
                    "area_ha": plot.area_ha,
                    "centroid_latitude": plot.centroid_latitude,
                    "centroid_longitude": plot.centroid_longitude,
                    "irrigation_method": plot.irrigation_method,
                },
                "campaign": None,
                "seed_lot": None,
                "seed_analysis": None,
                "weather": {
                    "snapshot_id": latest_weather.id if latest_weather else None,
                    "provider": latest_weather.provider if latest_weather else None,
                    "tmean_c": latest_weather.tmean_c if latest_weather else None,
                    "tmax_c": latest_weather.tmax_c if latest_weather else None,
                    "precipitation_mm": latest_weather.precipitation_mm if latest_weather else None,
                    "humidity_percent": latest_weather.humidity_percent if latest_weather else None,
                    "wind_speed_ms": latest_weather.wind_speed_ms if latest_weather else None,
                    "solar_radiation_estimate": latest_weather.solar_radiation_estimate if latest_weather else None,
                },
                "fao56_estimate": {
                    "formula": "ETc = Kc ajustado * ET0; deficit = max(ETc - lluvia efectiva, 0); litros = deficit_mm * area_m2",
                    "kc_base": round(kc_base, 3),
                    "seed_quality_factor": round(seed_factor, 3),
                    "kc_adjusted": round(kc_adjusted, 3),
                    "et0_mm_day": round(et0, 2),
                    "etc_mm_day": round(etc, 2),
                    "effective_rain_mm": round(effective_rain, 2),
                    "water_deficit_mm_day": round(water_deficit, 2),
                    "recommended_liters_today": round(recommended_liters_today, 2),
                    "recommended_m3_today": round(recommended_liters_today / 1000, 2),
                    "method_note": "Contexto preliminar por parcela: falta campana/lote de semilla vinculado, por eso se usa Kc base 0.8 y factor semilla 1.0.",
                },
                "missing_links": [
                    "Crear o vincular una campana de cultivo para esta parcela.",
                    "Seleccionar el lote SeedDSS usado en la parcela para ajustar Kc por calidad de semilla.",
                ],
            }
        )

    return contexts


def build_agent_runtime_context(db: Session) -> dict[str, Any]:
    producers = db.execute(select(Producer).order_by(Producer.created_at.desc()).limit(8)).scalars().all()
    plots = db.execute(select(Plot).order_by(Plot.created_at.desc()).limit(12)).scalars().all()
    campaigns = db.execute(select(CropCampaign).order_by(CropCampaign.created_at.desc()).limit(12)).scalars().all()
    weather = db.execute(select(WeatherSnapshot).order_by(WeatherSnapshot.created_at.desc()).limit(8)).scalars().all()
    seed_results = db.execute(select(SeedAnalysisResult).order_by(SeedAnalysisResult.created_at.desc()).limit(8)).scalars().all()
    seed_samples = db.execute(select(SeedSample).order_by(SeedSample.created_at.desc()).limit(16)).scalars().all()
    crop_coefficients = db.execute(select(CropCoefficient).order_by(CropCoefficient.created_at.desc()).limit(24)).scalars().all()
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
            "seed_samples": seed_samples,
            "seed_analysis_results": seed_results,
            "seed_verifier_external_contexts": _load_seed_verifier_contexts(),
            "irrigation_fao56_context": _build_irrigation_fao_context(
                plots=plots,
                campaigns=campaigns,
                weather=weather,
                seed_results=seed_results,
                seed_samples=seed_samples,
                crop_coefficients=crop_coefficients,
            ),
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
        "seed_verifier_external_contexts. Para preguntas de riego, parcelas, FAO-56, ET0, ETc, Kc, "
        "lamina de agua o ahorro, prioriza irrigation_fao56_context y cita la parcela, etapa, lote de "
        "semilla, clima y supuestos usados. Si falta informacion, dilo y sugiere que dato registrar. "
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
