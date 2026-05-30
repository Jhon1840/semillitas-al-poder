from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import AgentContextSnapshot
from app.schemas.entities import AgentContextRead
from app.services.agent_context_service import generate_campaign_context
from app.services.crud import get_or_404

router = APIRouter()


@router.post("/campaigns/{campaign_id}/context", response_model=AgentContextRead, status_code=status.HTTP_201_CREATED)
def create_campaign_context(campaign_id: UUID, db: Session = Depends(get_db)) -> AgentContextSnapshot:
    return generate_campaign_context(db, campaign_id)


@router.get("/contexts/{context_id}", response_model=AgentContextRead)
def get_context(context_id: UUID, db: Session = Depends(get_db)) -> AgentContextSnapshot:
    return get_or_404(db, AgentContextSnapshot, context_id)

