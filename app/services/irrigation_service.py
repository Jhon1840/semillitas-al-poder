from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    CropCampaign,
    CropCoefficient,
    IrrigationCalculation,
    IrrigationRecommendation,
    Plot,
    SeedAnalysisResult,
    SeedQualityFactor,
    WeatherSnapshot,
)
from app.schemas.entities import IrrigationCalculationRequest
from app.services.crud import get_or_404


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _find_seed_factor(db: Session, score: Decimal | None) -> SeedQualityFactor | None:
    if score is None:
        return None
    return db.scalar(
        select(SeedQualityFactor).where(
            SeedQualityFactor.min_score <= score,
            SeedQualityFactor.max_score >= score,
        )
    )


def calculate_irrigation(db: Session, payload: IrrigationCalculationRequest) -> tuple[IrrigationCalculation, IrrigationRecommendation]:
    campaign = get_or_404(db, CropCampaign, payload.crop_campaign_id)
    plot = get_or_404(db, Plot, campaign.plot_id)
    weather = db.get(WeatherSnapshot, payload.weather_snapshot_id) if payload.weather_snapshot_id else None
    seed_result = db.get(SeedAnalysisResult, payload.seed_analysis_result_id) if payload.seed_analysis_result_id else None

    kc = db.scalar(
        select(CropCoefficient.kc_value).where(
            CropCoefficient.crop_type == campaign.crop_type,
            CropCoefficient.stage == campaign.current_stage,
        )
    ) or Decimal("0.800")

    et0 = payload.et0_mm
    if et0 is None and weather and weather.tmean_c is not None:
        et0 = max(Decimal(weather.tmean_c) * Decimal("0.15"), Decimal("2.50"))
    et0 = et0 or Decimal("5.00")

    effective_rain = payload.effective_rain_mm
    if weather and weather.precipitation_mm is not None and effective_rain == Decimal("0"):
        effective_rain = Decimal(weather.precipitation_mm) * Decimal("0.80")

    area_m2 = Decimal(plot.area_m2 or 0)
    if area_m2 == 0 and plot.area_ha is not None:
        area_m2 = Decimal(plot.area_ha) * Decimal("10000")
    if area_m2 == 0:
        area_m2 = Decimal("10000")

    seed_score = Decimal(seed_result.quality_score) if seed_result and seed_result.quality_score is not None else campaign.seed_quality_score
    seed_factor = _find_seed_factor(db, seed_score)
    irrigation_factor = Decimal(seed_factor.irrigation_factor) if seed_factor else Decimal("1.000")
    risk_level = seed_factor.risk_level if seed_factor else "medio"

    etc = Decimal(et0) * Decimal(kc)
    deficit = max(etc - Decimal(effective_rain), Decimal("0"))
    base_liters = deficit * area_m2
    adjusted_liters = base_liters * irrigation_factor
    adjusted_m3 = adjusted_liters / Decimal("1000")

    calculation = IrrigationCalculation(
        crop_campaign_id=campaign.id,
        weather_snapshot_id=payload.weather_snapshot_id,
        seed_analysis_result_id=payload.seed_analysis_result_id,
        calculation_date=payload.calculation_date or date.today(),
        algorithm_name="nexo_simple_etc",
        algorithm_version="0.1.0",
        crop_stage=campaign.current_stage,
        kc_value=kc,
        et0_mm=_money(Decimal(et0)),
        etc_mm=_money(etc),
        effective_rain_mm=_money(Decimal(effective_rain)),
        water_deficit_mm=_money(deficit),
        plot_area_m2=_money(area_m2),
        base_irrigation_liters=_money(base_liters),
        seed_quality_factor=irrigation_factor,
        adjusted_irrigation_liters=_money(adjusted_liters),
        adjusted_irrigation_m3=_money(adjusted_m3),
        calculation_details_json={
            "formula": "ETc = ET0 * Kc; litros = deficit_mm * area_m2",
            "et0_method": "manual_or_temperature_estimate",
            "seed_quality_score": str(seed_score) if seed_score is not None else None,
            "seed_quality_factor": str(irrigation_factor),
        },
    )
    db.add(calculation)
    db.flush()

    priority = "baja"
    if deficit >= Decimal("6"):
        priority = "alta"
    elif deficit >= Decimal("3"):
        priority = "media"

    recommendation = IrrigationRecommendation(
        irrigation_calculation_id=calculation.id,
        crop_campaign_id=campaign.id,
        recommendation_date=calculation.calculation_date,
        priority=priority,
        recommended_liters=calculation.adjusted_irrigation_liters,
        recommended_m3=calculation.adjusted_irrigation_m3,
        recommended_mm=_money(deficit * irrigation_factor),
        risk_level=risk_level,
        message=f"Aplicar aproximadamente {_money(adjusted_m3)} m3 de agua.",
        explanation="La recomendacion combina ET0, Kc de la etapa, lluvia efectiva y ajuste por calidad de semilla.",
    )
    db.add(recommendation)
    db.flush()

    campaign.last_irrigation_recommendation_id = recommendation.id
    db.commit()
    db.refresh(calculation)
    db.refresh(recommendation)
    return calculation, recommendation

