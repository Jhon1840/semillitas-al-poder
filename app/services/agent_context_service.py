from datetime import date
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.entities import AgentContextSnapshot


def generate_campaign_context(db: Session, campaign_id: UUID) -> AgentContextSnapshot:
    row = db.execute(
        text("SELECT * FROM vw_campaign_current_status WHERE crop_campaign_id = :campaign_id"),
        {"campaign_id": campaign_id},
    ).mappings().first()

    facts: dict[str, Any] = dict(row) if row else {"crop_campaign_id": campaign_id}
    facts = jsonable_encoder(facts)
    summary = (
        f"Campana {facts.get('crop_type', 'agricola')} en {facts.get('plot_name', 'parcela sin nombre')}. "
        f"Calidad de semilla: {facts.get('seed_quality_category') or 'sin analizar'}."
    )

    snapshot = AgentContextSnapshot(
        crop_campaign_id=campaign_id,
        snapshot_date=date.today(),
        context_type="campaign_status",
        title="Estado actual de campana",
        summary=summary,
        facts_json=facts,
        source_tables_json={
            "views": ["vw_campaign_current_status"],
            "tables": ["crop_campaigns", "plots", "producers", "irrigation_recommendations", "pumping_recommendations"],
        },
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot

