from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import CropCampaign
from app.schemas.entities import CropCampaignCreate, CropCampaignRead
from app.services.crud import create_entity, get_or_404, list_entities

router = APIRouter()


@router.get("", response_model=list[CropCampaignRead])
def list_campaigns(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[CropCampaign]:
    return list_entities(db, CropCampaign, limit, offset)


@router.post("", response_model=CropCampaignRead, status_code=status.HTTP_201_CREATED)
def create_campaign(payload: CropCampaignCreate, db: Session = Depends(get_db)) -> CropCampaign:
    return create_entity(db, CropCampaign, payload.model_dump(exclude_unset=True))


@router.get("/{campaign_id}", response_model=CropCampaignRead)
def get_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> CropCampaign:
    return get_or_404(db, CropCampaign, campaign_id)

