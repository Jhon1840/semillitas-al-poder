import uuid

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    phone = Column(String(30))
    status = Column(String(30), nullable=False, server_default="active")
    last_login_at = Column(DateTime(timezone=True))


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(Text)


class UserRole(Base, TimestampMixin):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)


class Producer(Base, TimestampMixin):
    __tablename__ = "producers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    full_name = Column(String(180), nullable=False)
    document_type = Column(String(50))
    document_number = Column(String(80))
    phone = Column(String(30))
    email = Column(String(150))
    department = Column(String(100))
    municipality = Column(String(100))
    community = Column(String(150))
    address = Column(Text)


class Plot(Base, TimestampMixin):
    __tablename__ = "plots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    producer_id = Column(UUID(as_uuid=True), ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    code = Column(String(80))
    area_m2 = Column(Numeric(14, 2))
    area_ha = Column(Numeric(10, 4))
    centroid_latitude = Column(Numeric(10, 7))
    centroid_longitude = Column(Numeric(10, 7))
    polygon = Column(Geometry("POLYGON", srid=4326))
    polygon_geojson = Column(JSONB)
    soil_type = Column(String(100))
    slope_level = Column(String(50))
    water_source_type = Column(String(80))
    irrigation_method = Column(String(80))
    status = Column(String(30), nullable=False, server_default="active")


class CropCampaign(Base, TimestampMixin):
    __tablename__ = "crop_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plot_id = Column(UUID(as_uuid=True), ForeignKey("plots.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    crop_type = Column(String(80), nullable=False, server_default="soya")
    variety = Column(String(120))
    planting_date = Column(Date)
    expected_harvest_date = Column(Date)
    current_stage = Column(String(80))
    current_stage_started_at = Column(Date)
    status = Column(String(40), nullable=False, server_default="active")
    seed_quality_score = Column(Numeric(5, 2))
    seed_quality_category = Column(String(50))
    last_seed_analysis_result_id = Column(UUID(as_uuid=True))
    last_irrigation_recommendation_id = Column(UUID(as_uuid=True))
    last_pumping_recommendation_id = Column(UUID(as_uuid=True))


class SeedSample(Base, TimestampMixin):
    __tablename__ = "seed_samples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    uploaded_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    sample_code = Column(String(100), unique=True)
    seed_type = Column(String(80), nullable=False, server_default="soya")
    seed_lot_code = Column(String(100))
    source_supplier = Column(String(150))
    sample_weight_grams = Column(Numeric(10, 2))
    notes = Column(Text)
    status = Column(String(50), nullable=False, server_default="draft")


class SeedSampleImage(Base, TimestampMixin):
    __tablename__ = "seed_sample_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seed_sample_id = Column(UUID(as_uuid=True), ForeignKey("seed_samples.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    storage_provider = Column(String(80))
    file_name = Column(String(255))
    mime_type = Column(String(100))
    size_bytes = Column(BigInteger)
    width_px = Column(Integer)
    height_px = Column(Integer)
    capture_device = Column(String(120))
    metadata_json = Column(JSONB)


class ExternalApiCall(Base, TimestampMixin):
    __tablename__ = "external_api_calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    related_type = Column(String(100), nullable=False)
    related_id = Column(UUID(as_uuid=True), nullable=False)
    provider = Column(String(100), nullable=False)
    endpoint = Column(Text)
    method = Column(String(20))
    request_payload = Column(JSONB)
    response_payload = Column(JSONB)
    status_code = Column(Integer)
    status = Column(String(50))
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)


class SeedAnalysisResult(Base, TimestampMixin):
    __tablename__ = "seed_analysis_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seed_sample_id = Column(UUID(as_uuid=True), ForeignKey("seed_samples.id", ondelete="CASCADE"), nullable=False)
    external_api_call_id = Column(UUID(as_uuid=True), ForeignKey("external_api_calls.id", ondelete="SET NULL"))
    model_name = Column(String(150))
    model_version = Column(String(80))
    quality_score = Column(Numeric(5, 2))
    quality_category = Column(String(50))
    confidence_score = Column(Numeric(5, 4))
    germination_estimate = Column(Numeric(5, 2))
    purity_score = Column(Numeric(5, 2))
    damage_score = Column(Numeric(5, 2))
    impurity_score = Column(Numeric(5, 2))
    color_score = Column(Numeric(5, 2))
    shape_score = Column(Numeric(5, 2))
    size_score = Column(Numeric(5, 2))
    detected_seed_count = Column(Integer)
    damaged_seed_count = Column(Integer)
    impurity_count = Column(Integer)
    recommendation = Column(Text)
    raw_result_json = Column(JSONB)
    analyzed_at = Column(DateTime(timezone=True))


class WeatherSnapshot(Base, TimestampMixin):
    __tablename__ = "weather_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"))
    plot_id = Column(UUID(as_uuid=True), ForeignKey("plots.id", ondelete="CASCADE"))
    provider = Column(String(100), nullable=False)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    forecast_date = Column(Date)
    forecast_type = Column(String(50))
    tmin_c = Column(Numeric(6, 2))
    tmax_c = Column(Numeric(6, 2))
    tmean_c = Column(Numeric(6, 2))
    precipitation_mm = Column(Numeric(8, 2))
    humidity_percent = Column(Numeric(6, 2))
    cloud_cover_percent = Column(Numeric(6, 2))
    wind_speed_ms = Column(Numeric(8, 2))
    uv_index = Column(Numeric(6, 2))
    solar_radiation_estimate = Column(Numeric(10, 2))
    raw_response_json = Column(JSONB)
    fetched_at = Column(DateTime(timezone=True))


class WeatherHourlyForecast(Base, TimestampMixin):
    __tablename__ = "weather_hourly_forecasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    weather_snapshot_id = Column(UUID(as_uuid=True), ForeignKey("weather_snapshots.id", ondelete="CASCADE"), nullable=False)
    forecast_datetime = Column(DateTime(timezone=True), nullable=False)
    temperature_c = Column(Numeric(6, 2))
    precipitation_mm = Column(Numeric(8, 2))
    humidity_percent = Column(Numeric(6, 2))
    cloud_cover_percent = Column(Numeric(6, 2))
    wind_speed_ms = Column(Numeric(8, 2))
    uv_index = Column(Numeric(6, 2))
    solar_score = Column(Numeric(6, 2))
    is_daylight = Column(Boolean)


class CropCoefficient(Base, TimestampMixin):
    __tablename__ = "crop_coefficients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_type = Column(String(80), nullable=False)
    stage = Column(String(80), nullable=False)
    kc_value = Column(Numeric(6, 3), nullable=False)
    source = Column(String(150))
    notes = Column(Text)


class SeedQualityFactor(Base, TimestampMixin):
    __tablename__ = "seed_quality_factors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    min_score = Column(Numeric(5, 2), nullable=False)
    max_score = Column(Numeric(5, 2), nullable=False)
    category = Column(String(50), nullable=False)
    irrigation_factor = Column(Numeric(6, 3), nullable=False)
    risk_level = Column(String(50))
    explanation = Column(Text)


class IrrigationCalculation(Base, TimestampMixin):
    __tablename__ = "irrigation_calculations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    weather_snapshot_id = Column(UUID(as_uuid=True), ForeignKey("weather_snapshots.id", ondelete="SET NULL"))
    seed_analysis_result_id = Column(UUID(as_uuid=True), ForeignKey("seed_analysis_results.id", ondelete="SET NULL"))
    calculation_date = Column(Date, nullable=False)
    algorithm_name = Column(String(120))
    algorithm_version = Column(String(50))
    crop_stage = Column(String(80))
    kc_value = Column(Numeric(6, 3))
    et0_mm = Column(Numeric(8, 2))
    etc_mm = Column(Numeric(8, 2))
    effective_rain_mm = Column(Numeric(8, 2))
    water_deficit_mm = Column(Numeric(8, 2))
    plot_area_m2 = Column(Numeric(14, 2))
    base_irrigation_liters = Column(Numeric(14, 2))
    seed_quality_factor = Column(Numeric(6, 3))
    adjusted_irrigation_liters = Column(Numeric(14, 2))
    adjusted_irrigation_m3 = Column(Numeric(14, 2))
    calculation_details_json = Column(JSONB)


class IrrigationRecommendation(Base, TimestampMixin):
    __tablename__ = "irrigation_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    irrigation_calculation_id = Column(UUID(as_uuid=True), ForeignKey("irrigation_calculations.id", ondelete="CASCADE"), nullable=False)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    recommendation_date = Column(Date, nullable=False)
    priority = Column(String(50))
    recommended_liters = Column(Numeric(14, 2))
    recommended_m3 = Column(Numeric(14, 2))
    recommended_mm = Column(Numeric(8, 2))
    message = Column(Text)
    explanation = Column(Text)
    risk_level = Column(String(50))
    status = Column(String(50), nullable=False, server_default="generated")


class PumpSystem(Base, TimestampMixin):
    __tablename__ = "pump_systems"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plot_id = Column(UUID(as_uuid=True), ForeignKey("plots.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150))
    pump_type = Column(String(80))
    energy_source = Column(String(80))
    power_kw = Column(Numeric(10, 2))
    flow_rate_m3h = Column(Numeric(10, 2))
    head_meters = Column(Numeric(10, 2))
    diesel_consumption_lh = Column(Numeric(10, 3))
    diesel_price_per_liter = Column(Numeric(10, 2))
    efficiency_percent = Column(Numeric(6, 2))
    solar_available = Column(Boolean, nullable=False, server_default="false")
    notes = Column(Text)


class EnergyCalculation(Base, TimestampMixin):
    __tablename__ = "energy_calculations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    irrigation_recommendation_id = Column(UUID(as_uuid=True), ForeignKey("irrigation_recommendations.id", ondelete="CASCADE"), nullable=False)
    pump_system_id = Column(UUID(as_uuid=True), ForeignKey("pump_systems.id", ondelete="SET NULL"))
    calculation_date = Column(Date, nullable=False)
    volume_to_pump_m3 = Column(Numeric(14, 2))
    flow_rate_m3h = Column(Numeric(10, 2))
    estimated_pumping_hours = Column(Numeric(8, 2))
    estimated_energy_kwh = Column(Numeric(14, 2))
    estimated_diesel_liters = Column(Numeric(14, 2))
    diesel_price_per_liter = Column(Numeric(10, 2))
    estimated_cost = Column(Numeric(14, 2))
    solar_replacement_percent = Column(Numeric(6, 2))
    diesel_saved_liters = Column(Numeric(14, 2))
    money_saved = Column(Numeric(14, 2))
    co2_saved_kg = Column(Numeric(14, 2))
    calculation_details_json = Column(JSONB)


class PumpingRecommendation(Base, TimestampMixin):
    __tablename__ = "pumping_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    energy_calculation_id = Column(UUID(as_uuid=True), ForeignKey("energy_calculations.id", ondelete="CASCADE"), nullable=False)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    weather_snapshot_id = Column(UUID(as_uuid=True), ForeignKey("weather_snapshots.id", ondelete="SET NULL"))
    recommended_start_time = Column(Time)
    recommended_end_time = Column(Time)
    recommended_hours = Column(Numeric(8, 2))
    solar_score_avg = Column(Numeric(6, 2))
    message = Column(Text)
    explanation = Column(Text)
    status = Column(String(50), nullable=False, server_default="generated")


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    seed_sample_id = Column(UUID(as_uuid=True), ForeignKey("seed_samples.id", ondelete="SET NULL"))
    irrigation_recommendation_id = Column(UUID(as_uuid=True), ForeignKey("irrigation_recommendations.id", ondelete="SET NULL"))
    pumping_recommendation_id = Column(UUID(as_uuid=True), ForeignKey("pumping_recommendations.id", ondelete="SET NULL"))
    report_type = Column(String(80))
    title = Column(String(200))
    summary = Column(Text)
    content_json = Column(JSONB)
    pdf_url = Column(Text)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class AgentContextSnapshot(Base, TimestampMixin):
    __tablename__ = "agent_context_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="CASCADE"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    context_type = Column(String(80))
    title = Column(String(200))
    summary = Column(Text)
    facts_json = Column(JSONB)
    source_tables_json = Column(JSONB)


class AgentQuery(Base, TimestampMixin):
    __tablename__ = "agent_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    crop_campaign_id = Column(UUID(as_uuid=True), ForeignKey("crop_campaigns.id", ondelete="SET NULL"))
    question = Column(Text, nullable=False)
    answer = Column(Text)
    intent = Column(String(120))
    used_context_snapshot_id = Column(UUID(as_uuid=True), ForeignKey("agent_context_snapshots.id", ondelete="SET NULL"))
    confidence_score = Column(Numeric(5, 4))


class AgentToolCall(Base, TimestampMixin):
    __tablename__ = "agent_tool_calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_query_id = Column(UUID(as_uuid=True), ForeignKey("agent_queries.id", ondelete="CASCADE"), nullable=False)
    tool_name = Column(String(150))
    input_json = Column(JSONB)
    output_json = Column(JSONB)
    status = Column(String(50))
    duration_ms = Column(Integer)


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(120))
    entity_type = Column(String(120))
    entity_id = Column(UUID(as_uuid=True))
    message = Column(Text)
    metadata_json = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

