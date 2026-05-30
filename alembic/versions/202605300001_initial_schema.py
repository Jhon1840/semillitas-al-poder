"""initial NEXO schema

Revision ID: 202605300001
Revises:
Create Date: 2026-05-30
"""
from typing import Sequence, Union

from alembic import op

revision: str = "202605300001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.execute(
        """
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone VARCHAR(30),
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(80) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE user_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id)
        );

        CREATE TABLE producers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            full_name VARCHAR(180) NOT NULL,
            document_type VARCHAR(50),
            document_number VARCHAR(80),
            phone VARCHAR(30),
            email VARCHAR(150),
            department VARCHAR(100),
            municipality VARCHAR(100),
            community VARCHAR(150),
            address TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE plots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(80),
            area_m2 NUMERIC(14,2),
            area_ha NUMERIC(10,4),
            centroid_latitude NUMERIC(10,7),
            centroid_longitude NUMERIC(10,7),
            polygon geometry(POLYGON, 4326),
            polygon_geojson JSONB,
            soil_type VARCHAR(100),
            slope_level VARCHAR(50),
            water_source_type VARCHAR(80),
            irrigation_method VARCHAR(80),
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE crop_campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            crop_type VARCHAR(80) NOT NULL DEFAULT 'soya',
            variety VARCHAR(120),
            planting_date DATE,
            expected_harvest_date DATE,
            current_stage VARCHAR(80),
            current_stage_started_at DATE,
            status VARCHAR(40) NOT NULL DEFAULT 'active',
            seed_quality_score NUMERIC(5,2),
            seed_quality_category VARCHAR(50),
            last_seed_analysis_result_id UUID,
            last_irrigation_recommendation_id UUID,
            last_pumping_recommendation_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE seed_samples (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            sample_code VARCHAR(100) UNIQUE,
            seed_type VARCHAR(80) NOT NULL DEFAULT 'soya',
            seed_lot_code VARCHAR(100),
            source_supplier VARCHAR(150),
            sample_weight_grams NUMERIC(10,2),
            notes TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE seed_sample_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            seed_sample_id UUID NOT NULL REFERENCES seed_samples(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            storage_provider VARCHAR(80),
            file_name VARCHAR(255),
            mime_type VARCHAR(100),
            size_bytes BIGINT,
            width_px INTEGER,
            height_px INTEGER,
            capture_device VARCHAR(120),
            metadata_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE external_api_calls (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            related_type VARCHAR(100) NOT NULL,
            related_id UUID NOT NULL,
            provider VARCHAR(100) NOT NULL,
            endpoint TEXT,
            method VARCHAR(20),
            request_payload JSONB,
            response_payload JSONB,
            status_code INTEGER,
            status VARCHAR(50),
            error_message TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE seed_analysis_results (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            seed_sample_id UUID NOT NULL REFERENCES seed_samples(id) ON DELETE CASCADE,
            external_api_call_id UUID REFERENCES external_api_calls(id) ON DELETE SET NULL,
            model_name VARCHAR(150),
            model_version VARCHAR(80),
            quality_score NUMERIC(5,2),
            quality_category VARCHAR(50),
            confidence_score NUMERIC(5,4),
            germination_estimate NUMERIC(5,2),
            purity_score NUMERIC(5,2),
            damage_score NUMERIC(5,2),
            impurity_score NUMERIC(5,2),
            color_score NUMERIC(5,2),
            shape_score NUMERIC(5,2),
            size_score NUMERIC(5,2),
            detected_seed_count INTEGER,
            damaged_seed_count INTEGER,
            impurity_count INTEGER,
            recommendation TEXT,
            raw_result_json JSONB,
            analyzed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE weather_snapshots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_campaign_id UUID REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            plot_id UUID REFERENCES plots(id) ON DELETE CASCADE,
            provider VARCHAR(100) NOT NULL,
            latitude NUMERIC(10,7),
            longitude NUMERIC(10,7),
            forecast_date DATE,
            forecast_type VARCHAR(50),
            tmin_c NUMERIC(6,2),
            tmax_c NUMERIC(6,2),
            tmean_c NUMERIC(6,2),
            precipitation_mm NUMERIC(8,2),
            humidity_percent NUMERIC(6,2),
            cloud_cover_percent NUMERIC(6,2),
            wind_speed_ms NUMERIC(8,2),
            uv_index NUMERIC(6,2),
            solar_radiation_estimate NUMERIC(10,2),
            raw_response_json JSONB,
            fetched_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE weather_hourly_forecasts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            weather_snapshot_id UUID NOT NULL REFERENCES weather_snapshots(id) ON DELETE CASCADE,
            forecast_datetime TIMESTAMPTZ NOT NULL,
            temperature_c NUMERIC(6,2),
            precipitation_mm NUMERIC(8,2),
            humidity_percent NUMERIC(6,2),
            cloud_cover_percent NUMERIC(6,2),
            wind_speed_ms NUMERIC(8,2),
            uv_index NUMERIC(6,2),
            solar_score NUMERIC(6,2),
            is_daylight BOOLEAN,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE crop_coefficients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_type VARCHAR(80) NOT NULL,
            stage VARCHAR(80) NOT NULL,
            kc_value NUMERIC(6,3) NOT NULL,
            source VARCHAR(150),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE seed_quality_factors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            min_score NUMERIC(5,2) NOT NULL,
            max_score NUMERIC(5,2) NOT NULL,
            category VARCHAR(50) NOT NULL,
            irrigation_factor NUMERIC(6,3) NOT NULL,
            risk_level VARCHAR(50),
            explanation TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE irrigation_calculations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL,
            seed_analysis_result_id UUID REFERENCES seed_analysis_results(id) ON DELETE SET NULL,
            calculation_date DATE NOT NULL,
            algorithm_name VARCHAR(120),
            algorithm_version VARCHAR(50),
            crop_stage VARCHAR(80),
            kc_value NUMERIC(6,3),
            et0_mm NUMERIC(8,2),
            etc_mm NUMERIC(8,2),
            effective_rain_mm NUMERIC(8,2),
            water_deficit_mm NUMERIC(8,2),
            plot_area_m2 NUMERIC(14,2),
            base_irrigation_liters NUMERIC(14,2),
            seed_quality_factor NUMERIC(6,3),
            adjusted_irrigation_liters NUMERIC(14,2),
            adjusted_irrigation_m3 NUMERIC(14,2),
            calculation_details_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE irrigation_recommendations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            irrigation_calculation_id UUID NOT NULL REFERENCES irrigation_calculations(id) ON DELETE CASCADE,
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            recommendation_date DATE NOT NULL,
            priority VARCHAR(50),
            recommended_liters NUMERIC(14,2),
            recommended_m3 NUMERIC(14,2),
            recommended_mm NUMERIC(8,2),
            message TEXT,
            explanation TEXT,
            risk_level VARCHAR(50),
            status VARCHAR(50) NOT NULL DEFAULT 'generated',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE pump_systems (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
            name VARCHAR(150),
            pump_type VARCHAR(80),
            energy_source VARCHAR(80),
            power_kw NUMERIC(10,2),
            flow_rate_m3h NUMERIC(10,2),
            head_meters NUMERIC(10,2),
            diesel_consumption_lh NUMERIC(10,3),
            diesel_price_per_liter NUMERIC(10,2),
            efficiency_percent NUMERIC(6,2),
            solar_available BOOLEAN NOT NULL DEFAULT false,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE energy_calculations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            irrigation_recommendation_id UUID NOT NULL REFERENCES irrigation_recommendations(id) ON DELETE CASCADE,
            pump_system_id UUID REFERENCES pump_systems(id) ON DELETE SET NULL,
            calculation_date DATE NOT NULL,
            volume_to_pump_m3 NUMERIC(14,2),
            flow_rate_m3h NUMERIC(10,2),
            estimated_pumping_hours NUMERIC(8,2),
            estimated_energy_kwh NUMERIC(14,2),
            estimated_diesel_liters NUMERIC(14,2),
            diesel_price_per_liter NUMERIC(10,2),
            estimated_cost NUMERIC(14,2),
            solar_replacement_percent NUMERIC(6,2),
            diesel_saved_liters NUMERIC(14,2),
            money_saved NUMERIC(14,2),
            co2_saved_kg NUMERIC(14,2),
            calculation_details_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE pumping_recommendations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            energy_calculation_id UUID NOT NULL REFERENCES energy_calculations(id) ON DELETE CASCADE,
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL,
            recommended_start_time TIME,
            recommended_end_time TIME,
            recommended_hours NUMERIC(8,2),
            solar_score_avg NUMERIC(6,2),
            message TEXT,
            explanation TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'generated',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            seed_sample_id UUID REFERENCES seed_samples(id) ON DELETE SET NULL,
            irrigation_recommendation_id UUID REFERENCES irrigation_recommendations(id) ON DELETE SET NULL,
            pumping_recommendation_id UUID REFERENCES pumping_recommendations(id) ON DELETE SET NULL,
            report_type VARCHAR(80),
            title VARCHAR(200),
            summary TEXT,
            content_json JSONB,
            pdf_url TEXT,
            created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE agent_context_snapshots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_campaign_id UUID NOT NULL REFERENCES crop_campaigns(id) ON DELETE CASCADE,
            snapshot_date DATE NOT NULL,
            context_type VARCHAR(80),
            title VARCHAR(200),
            summary TEXT,
            facts_json JSONB,
            source_tables_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE agent_queries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            crop_campaign_id UUID REFERENCES crop_campaigns(id) ON DELETE SET NULL,
            question TEXT NOT NULL,
            answer TEXT,
            intent VARCHAR(120),
            used_context_snapshot_id UUID REFERENCES agent_context_snapshots(id) ON DELETE SET NULL,
            confidence_score NUMERIC(5,4),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE agent_tool_calls (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_query_id UUID NOT NULL REFERENCES agent_queries(id) ON DELETE CASCADE,
            tool_name VARCHAR(150),
            input_json JSONB,
            output_json JSONB,
            status VARCHAR(50),
            duration_ms INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE system_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(120),
            entity_type VARCHAR(120),
            entity_id UUID,
            message TEXT,
            metadata_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )

    op.execute(
        """
        INSERT INTO roles (name, description) VALUES
            ('admin', 'Administrador del sistema'),
            ('productor', 'Productor agricola'),
            ('laboratorista', 'Usuario de laboratorio'),
            ('asesor_tecnico', 'Asesor tecnico agricola')
        ON CONFLICT (name) DO NOTHING;

        INSERT INTO crop_coefficients (crop_type, stage, kc_value, source, notes) VALUES
            ('soya', 'inicial', 0.400, 'FAO56 referencia base', 'Valor inicial editable'),
            ('soya', 'desarrollo', 0.800, 'FAO56 referencia base', 'Valor de desarrollo editable'),
            ('soya', 'floracion', 1.150, 'FAO56 referencia base', 'Valor pico editable'),
            ('soya', 'llenado_grano', 1.000, 'FAO56 referencia base', 'Valor medio editable'),
            ('soya', 'maduracion', 0.500, 'FAO56 referencia base', 'Valor final editable')
        ON CONFLICT DO NOTHING;

        INSERT INTO seed_quality_factors
            (min_score, max_score, category, irrigation_factor, risk_level, explanation)
        VALUES
            (90, 100, 'excelente', 0.950, 'bajo', 'Semilla de alta calidad; se permite un ajuste operativo menor.'),
            (75, 89.99, 'buena', 1.000, 'bajo', 'Semilla apta; mantener plan de riego base.'),
            (55, 74.99, 'regular', 1.100, 'medio', 'Semilla con riesgo moderado; aumentar seguimiento y agua inicial.'),
            (35, 54.99, 'mala', 1.200, 'alto', 'Semilla riesgosa; reforzar manejo y monitoreo.'),
            (0, 34.99, 'critica', 1.300, 'critico', 'Semilla critica; revisar decision de siembra.')
        ON CONFLICT DO NOTHING;
        """
    )

    op.execute(
        """
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_producers_user_id ON producers(user_id);
        CREATE INDEX idx_plots_producer_id ON plots(producer_id);
        CREATE INDEX idx_plots_polygon ON plots USING GIST(polygon);
        CREATE INDEX idx_crop_campaigns_plot_id ON crop_campaigns(plot_id);
        CREATE INDEX idx_crop_campaigns_status ON crop_campaigns(status);
        CREATE INDEX idx_seed_samples_campaign_id ON seed_samples(crop_campaign_id);
        CREATE INDEX idx_seed_sample_images_sample_id ON seed_sample_images(seed_sample_id);
        CREATE INDEX idx_seed_analysis_results_sample_id ON seed_analysis_results(seed_sample_id);
        CREATE INDEX idx_external_api_calls_related ON external_api_calls(related_type, related_id);
        CREATE INDEX idx_external_api_calls_provider ON external_api_calls(provider);
        CREATE INDEX idx_weather_snapshots_campaign_date ON weather_snapshots(crop_campaign_id, forecast_date);
        CREATE INDEX idx_weather_hourly_snapshot ON weather_hourly_forecasts(weather_snapshot_id, forecast_datetime);
        CREATE INDEX idx_irrigation_calculations_campaign_date ON irrigation_calculations(crop_campaign_id, calculation_date);
        CREATE INDEX idx_irrigation_recommendations_campaign_date ON irrigation_recommendations(crop_campaign_id, recommendation_date);
        CREATE INDEX idx_pump_systems_plot_id ON pump_systems(plot_id);
        CREATE INDEX idx_energy_calculations_irrigation ON energy_calculations(irrigation_recommendation_id);
        CREATE INDEX idx_pumping_recommendations_campaign ON pumping_recommendations(crop_campaign_id);
        CREATE INDEX idx_agent_context_campaign_date ON agent_context_snapshots(crop_campaign_id, snapshot_date);
        CREATE INDEX idx_agent_queries_user_campaign ON agent_queries(user_id, crop_campaign_id);
        """
    )

    op.execute(
        """
        CREATE VIEW vw_campaign_current_status AS
        SELECT
            cc.id AS crop_campaign_id,
            p.full_name AS producer_name,
            pl.name AS plot_name,
            pl.area_ha,
            cc.crop_type,
            cc.current_stage,
            cc.seed_quality_score,
            cc.seed_quality_category,
            ir.recommended_liters AS last_irrigation_liters,
            ir.recommendation_date AS last_irrigation_date,
            concat(pr.recommended_start_time, '-', pr.recommended_end_time) AS last_pumping_window,
            ec.diesel_saved_liters,
            ec.money_saved,
            ec.co2_saved_kg
        FROM crop_campaigns cc
        JOIN plots pl ON pl.id = cc.plot_id
        JOIN producers p ON p.id = pl.producer_id
        LEFT JOIN irrigation_recommendations ir ON ir.id = cc.last_irrigation_recommendation_id
        LEFT JOIN pumping_recommendations pr ON pr.id = cc.last_pumping_recommendation_id
        LEFT JOIN energy_calculations ec ON ec.id = pr.energy_calculation_id;

        CREATE VIEW vw_seed_analysis_summary AS
        SELECT
            ss.crop_campaign_id,
            ss.id AS seed_sample_id,
            ss.sample_code,
            ss.seed_lot_code,
            sar.quality_score,
            sar.quality_category,
            sar.germination_estimate,
            sar.purity_score,
            sar.damage_score,
            sar.impurity_score,
            sar.recommendation,
            sar.analyzed_at
        FROM seed_samples ss
        JOIN seed_analysis_results sar ON sar.seed_sample_id = ss.id;

        CREATE VIEW vw_irrigation_explanation AS
        SELECT
            ic.crop_campaign_id,
            ic.calculation_date,
            ic.et0_mm,
            ic.kc_value,
            ic.etc_mm,
            ic.effective_rain_mm,
            ic.water_deficit_mm,
            ic.plot_area_m2,
            ic.base_irrigation_liters,
            ic.seed_quality_factor,
            ic.adjusted_irrigation_liters,
            ir.explanation
        FROM irrigation_calculations ic
        LEFT JOIN irrigation_recommendations ir ON ir.irrigation_calculation_id = ic.id;

        CREATE VIEW vw_pumping_summary AS
        SELECT
            pr.crop_campaign_id,
            pr.recommended_start_time,
            pr.recommended_end_time,
            pr.recommended_hours,
            ec.volume_to_pump_m3,
            ec.estimated_energy_kwh,
            ec.diesel_saved_liters,
            ec.money_saved,
            ec.co2_saved_kg,
            pr.solar_score_avg
        FROM pumping_recommendations pr
        JOIN energy_calculations ec ON ec.id = pr.energy_calculation_id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS vw_pumping_summary")
    op.execute("DROP VIEW IF EXISTS vw_irrigation_explanation")
    op.execute("DROP VIEW IF EXISTS vw_seed_analysis_summary")
    op.execute("DROP VIEW IF EXISTS vw_campaign_current_status")

    for table_name in (
        "system_events",
        "agent_tool_calls",
        "agent_queries",
        "agent_context_snapshots",
        "reports",
        "pumping_recommendations",
        "energy_calculations",
        "pump_systems",
        "irrigation_recommendations",
        "irrigation_calculations",
        "seed_quality_factors",
        "crop_coefficients",
        "weather_hourly_forecasts",
        "weather_snapshots",
        "seed_analysis_results",
        "external_api_calls",
        "seed_sample_images",
        "seed_samples",
        "crop_campaigns",
        "plots",
        "producers",
        "user_roles",
        "roles",
        "users",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE")

