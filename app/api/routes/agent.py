from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from httpx import HTTPError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.entities import AgentContextSnapshot
from app.schemas.entities import AgentContextRead
from app.services.gemini_service import ask_gemini, build_agent_runtime_context
from app.services.agent_context_service import generate_campaign_context
from app.services.crud import get_or_404

router = APIRouter()


class AgentChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|model)$")
    content: str = Field(min_length=1, max_length=4000)


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[AgentChatMessage] = Field(default_factory=list)
    context: dict | None = None


class AgentChatResponse(BaseModel):
    answer: str
    model: str
    context_used: bool


@router.post("/campaigns/{campaign_id}/context", response_model=AgentContextRead, status_code=status.HTTP_201_CREATED)
def create_campaign_context(campaign_id: UUID, db: Session = Depends(get_db)) -> AgentContextSnapshot:
    return generate_campaign_context(db, campaign_id)


@router.get("/contexts/{context_id}", response_model=AgentContextRead)
def get_context(context_id: UUID, db: Session = Depends(get_db)) -> AgentContextSnapshot:
    return get_or_404(db, AgentContextSnapshot, context_id)


@router.get("/runtime-context")
def get_runtime_context(
    db: Session = Depends(get_db),
) -> dict:
    return build_agent_runtime_context(db)


@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
) -> AgentChatResponse:
    context = payload.context or build_agent_runtime_context(db)
    try:
        answer = await ask_gemini(
            message=payload.message,
            history=[item.model_dump() for item in payload.history],
            context=context,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar Gemini: {exc}") from exc

    return AgentChatResponse(answer=answer, model=settings.gemini_model, context_used=bool(context))
