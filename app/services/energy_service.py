from datetime import date, time
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.entities import (
    EnergyCalculation,
    IrrigationRecommendation,
    PumpSystem,
    PumpingRecommendation,
    CropCampaign,
)
from app.schemas.entities import EnergyCalculationRequest
from app.services.crud import get_or_404


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_energy(db: Session, payload: EnergyCalculationRequest) -> tuple[EnergyCalculation, PumpingRecommendation]:
    irrigation = get_or_404(db, IrrigationRecommendation, payload.irrigation_recommendation_id)
    campaign = get_or_404(db, CropCampaign, irrigation.crop_campaign_id)
    pump = db.get(PumpSystem, payload.pump_system_id) if payload.pump_system_id else None

    volume_m3 = Decimal(irrigation.recommended_m3 or 0)
    flow_rate = Decimal(pump.flow_rate_m3h) if pump and pump.flow_rate_m3h else Decimal("10")
    power_kw = Decimal(pump.power_kw) if pump and pump.power_kw else Decimal("3")
    diesel_lh = Decimal(pump.diesel_consumption_lh) if pump and pump.diesel_consumption_lh else Decimal("1.20")
    diesel_price = Decimal(pump.diesel_price_per_liter) if pump and pump.diesel_price_per_liter else Decimal("3.72")
    solar_percent = Decimal(payload.solar_replacement_percent)

    hours = volume_m3 / flow_rate if flow_rate > 0 else Decimal("0")
    energy_kwh = power_kw * hours
    diesel_liters = diesel_lh * hours
    estimated_cost = diesel_liters * diesel_price
    diesel_saved = diesel_liters * solar_percent / Decimal("100")
    money_saved = diesel_saved * diesel_price
    co2_saved = diesel_saved * Decimal("2.68")

    calculation = EnergyCalculation(
        irrigation_recommendation_id=irrigation.id,
        pump_system_id=payload.pump_system_id,
        calculation_date=payload.calculation_date or date.today(),
        volume_to_pump_m3=_q(volume_m3),
        flow_rate_m3h=_q(flow_rate),
        estimated_pumping_hours=_q(hours),
        estimated_energy_kwh=_q(energy_kwh),
        estimated_diesel_liters=_q(diesel_liters),
        diesel_price_per_liter=_q(diesel_price),
        estimated_cost=_q(estimated_cost),
        solar_replacement_percent=_q(solar_percent),
        diesel_saved_liters=_q(diesel_saved),
        money_saved=_q(money_saved),
        co2_saved_kg=_q(co2_saved),
        calculation_details_json={
            "formula": "horas = volumen_m3 / caudal_m3h",
            "co2_factor_kg_per_liter": "2.68",
            "defaults_used": pump is None,
        },
    )
    db.add(calculation)
    db.flush()

    recommended_hours = min(hours, Decimal("4"))
    recommendation = PumpingRecommendation(
        energy_calculation_id=calculation.id,
        crop_campaign_id=campaign.id,
        recommended_start_time=time(10, 0),
        recommended_end_time=time(14, 0),
        recommended_hours=_q(recommended_hours),
        solar_score_avg=Decimal("85.00"),
        message="Bombear preferentemente entre 10:00 y 14:00 para aprovechar radiacion solar.",
        explanation="Ventana base para MVP; luego se ajusta con pronostico horario real.",
    )
    db.add(recommendation)
    db.flush()

    campaign.last_pumping_recommendation_id = recommendation.id
    db.commit()
    db.refresh(calculation)
    db.refresh(recommendation)
    return calculation, recommendation

