from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProducerCreate(BaseModel):
    user_id: UUID | None = None
    full_name: str
    document_type: str | None = None
    document_number: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    municipality: str | None = None
    community: str | None = None
    address: str | None = None


class ProducerRead(ProducerCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PlotCreate(BaseModel):
    producer_id: UUID
    name: str
    code: str | None = None
    area_m2: Decimal | None = None
    area_ha: Decimal | None = None
    centroid_latitude: Decimal | None = None
    centroid_longitude: Decimal | None = None
    polygon_geojson: dict[str, Any] | None = None
    soil_type: str | None = None
    slope_level: str | None = None
    water_source_type: str | None = None
    irrigation_method: str | None = None
    status: str = "active"


class PlotRead(PlotCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class CropCampaignCreate(BaseModel):
    plot_id: UUID
    name: str
    crop_type: str = "soya"
    variety: str | None = None
    planting_date: date | None = None
    expected_harvest_date: date | None = None
    current_stage: str | None = None
    current_stage_started_at: date | None = None
    status: str = "active"


class CropCampaignRead(CropCampaignCreate, OrmModel):
    id: UUID
    seed_quality_score: Decimal | None = None
    seed_quality_category: str | None = None
    last_seed_analysis_result_id: UUID | None = None
    last_irrigation_recommendation_id: UUID | None = None
    last_pumping_recommendation_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class SeedSampleCreate(BaseModel):
    crop_campaign_id: UUID
    uploaded_by_user_id: UUID | None = None
    sample_code: str | None = None
    seed_type: str = "soya"
    seed_lot_code: str | None = None
    source_supplier: str | None = None
    sample_weight_grams: Decimal | None = None
    notes: str | None = None
    status: str = "draft"


class SeedSampleRead(SeedSampleCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class SeedSampleImageCreate(BaseModel):
    seed_sample_id: UUID
    image_url: str
    storage_provider: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    width_px: int | None = None
    height_px: int | None = None
    capture_device: str | None = None
    metadata_json: dict[str, Any] | None = None


class SeedSampleImageRead(SeedSampleImageCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class SeedAnalysisResultCreate(BaseModel):
    seed_sample_id: UUID
    external_api_call_id: UUID | None = None
    model_name: str | None = None
    model_version: str | None = None
    quality_score: Decimal | None = None
    quality_category: str | None = None
    confidence_score: Decimal | None = None
    germination_estimate: Decimal | None = None
    purity_score: Decimal | None = None
    damage_score: Decimal | None = None
    impurity_score: Decimal | None = None
    color_score: Decimal | None = None
    shape_score: Decimal | None = None
    size_score: Decimal | None = None
    detected_seed_count: int | None = None
    damaged_seed_count: int | None = None
    impurity_count: int | None = None
    recommendation: str | None = None
    raw_result_json: dict[str, Any] | None = None
    analyzed_at: datetime | None = None


class SeedAnalysisResultRead(SeedAnalysisResultCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class WeatherSnapshotCreate(BaseModel):
    crop_campaign_id: UUID | None = None
    plot_id: UUID | None = None
    provider: str = "manual"
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    forecast_date: date | None = None
    forecast_type: str | None = "daily"
    tmin_c: Decimal | None = None
    tmax_c: Decimal | None = None
    tmean_c: Decimal | None = None
    precipitation_mm: Decimal | None = None
    humidity_percent: Decimal | None = None
    cloud_cover_percent: Decimal | None = None
    wind_speed_ms: Decimal | None = None
    uv_index: Decimal | None = None
    solar_radiation_estimate: Decimal | None = None
    raw_response_json: dict[str, Any] | None = None
    fetched_at: datetime | None = None


class WeatherSnapshotRead(WeatherSnapshotCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class WeatherFetchRequest(BaseModel):
    crop_campaign_id: UUID | None = None
    plot_id: UUID | None = None
    latitude: Decimal
    longitude: Decimal
    forecast_date: date | None = None


class IrrigationCalculationRequest(BaseModel):
    crop_campaign_id: UUID
    weather_snapshot_id: UUID | None = None
    seed_analysis_result_id: UUID | None = None
    calculation_date: date | None = None
    et0_mm: Decimal | None = None
    effective_rain_mm: Decimal = Decimal("0")


class IrrigationCalculationRead(OrmModel):
    id: UUID
    crop_campaign_id: UUID
    weather_snapshot_id: UUID | None = None
    seed_analysis_result_id: UUID | None = None
    calculation_date: date
    algorithm_name: str | None = None
    algorithm_version: str | None = None
    crop_stage: str | None = None
    kc_value: Decimal | None = None
    et0_mm: Decimal | None = None
    etc_mm: Decimal | None = None
    effective_rain_mm: Decimal | None = None
    water_deficit_mm: Decimal | None = None
    plot_area_m2: Decimal | None = None
    base_irrigation_liters: Decimal | None = None
    seed_quality_factor: Decimal | None = None
    adjusted_irrigation_liters: Decimal | None = None
    adjusted_irrigation_m3: Decimal | None = None
    calculation_details_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class IrrigationRecommendationRead(OrmModel):
    id: UUID
    irrigation_calculation_id: UUID
    crop_campaign_id: UUID
    recommendation_date: date
    priority: str | None = None
    recommended_liters: Decimal | None = None
    recommended_m3: Decimal | None = None
    recommended_mm: Decimal | None = None
    message: str | None = None
    explanation: str | None = None
    risk_level: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class IrrigationCalculationResponse(BaseModel):
    calculation: IrrigationCalculationRead
    recommendation: IrrigationRecommendationRead


class PumpSystemCreate(BaseModel):
    plot_id: UUID
    name: str | None = None
    pump_type: str | None = None
    energy_source: str | None = None
    power_kw: Decimal | None = None
    flow_rate_m3h: Decimal | None = None
    head_meters: Decimal | None = None
    diesel_consumption_lh: Decimal | None = None
    diesel_price_per_liter: Decimal | None = None
    efficiency_percent: Decimal | None = None
    solar_available: bool = False
    notes: str | None = None


class PumpSystemRead(PumpSystemCreate, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class EnergyCalculationRequest(BaseModel):
    irrigation_recommendation_id: UUID
    pump_system_id: UUID | None = None
    calculation_date: date | None = None
    solar_replacement_percent: Decimal = Decimal("70")


class EnergyCalculationRead(OrmModel):
    id: UUID
    irrigation_recommendation_id: UUID
    pump_system_id: UUID | None = None
    calculation_date: date
    volume_to_pump_m3: Decimal | None = None
    flow_rate_m3h: Decimal | None = None
    estimated_pumping_hours: Decimal | None = None
    estimated_energy_kwh: Decimal | None = None
    estimated_diesel_liters: Decimal | None = None
    diesel_price_per_liter: Decimal | None = None
    estimated_cost: Decimal | None = None
    solar_replacement_percent: Decimal | None = None
    diesel_saved_liters: Decimal | None = None
    money_saved: Decimal | None = None
    co2_saved_kg: Decimal | None = None
    calculation_details_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class PumpingRecommendationRead(OrmModel):
    id: UUID
    energy_calculation_id: UUID
    crop_campaign_id: UUID
    weather_snapshot_id: UUID | None = None
    recommended_start_time: time | None = None
    recommended_end_time: time | None = None
    recommended_hours: Decimal | None = None
    solar_score_avg: Decimal | None = None
    message: str | None = None
    explanation: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class EnergyCalculationResponse(BaseModel):
    calculation: EnergyCalculationRead
    recommendation: PumpingRecommendationRead


class AgentContextRead(OrmModel):
    id: UUID
    crop_campaign_id: UUID
    snapshot_date: date
    context_type: str | None = None
    title: str | None = None
    summary: str | None = None
    facts_json: dict[str, Any] | None = None
    source_tables_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

