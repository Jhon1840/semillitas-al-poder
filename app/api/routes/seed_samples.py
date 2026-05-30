from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from httpx import HTTPError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.integrations.seeddss_client import send_seed_images_to_external_service
from app.models.entities import CropCampaign, SeedAnalysisResult, SeedSample, SeedSampleImage
from app.schemas.entities import (
    SeedAnalysisResultCreate,
    SeedAnalysisResultRead,
    SeedSampleCreate,
    SeedSampleImageCreate,
    SeedSampleImageRead,
    SeedSampleRead,
)
from app.services.crud import create_entity, get_or_404, list_entities

router = APIRouter()


@router.get("", response_model=list[SeedSampleRead])
def list_seed_samples(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[SeedSample]:
    return list_entities(db, SeedSample, limit, offset)


@router.post("", response_model=SeedSampleRead, status_code=status.HTTP_201_CREATED)
def create_seed_sample(payload: SeedSampleCreate, db: Session = Depends(get_db)) -> SeedSample:
    return create_entity(db, SeedSample, payload.model_dump(exclude_unset=True))


@router.post("/images", response_model=SeedSampleImageRead, status_code=status.HTTP_201_CREATED)
def add_seed_sample_image(payload: SeedSampleImageCreate, db: Session = Depends(get_db)) -> SeedSampleImage:
    return create_entity(db, SeedSampleImage, payload.model_dump(exclude_unset=True))


@router.post("/external-analysis", status_code=status.HTTP_202_ACCEPTED)
async def send_images_to_external_analysis(
    files: list[UploadFile] = File(...),
    sample_code: str | None = Form(default=None),
    seed_lot_code: str | None = Form(default=None),
) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="Debes enviar al menos una imagen.")

    invalid_files = [file.filename for file in files if file.content_type and not file.content_type.startswith("image/")]
    if invalid_files:
        raise HTTPException(status_code=400, detail=f"Solo se aceptan imagenes: {', '.join(invalid_files)}")

    try:
        external_response = await send_seed_images_to_external_service(files, sample_code, seed_lot_code)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"El servicio externo rechazo la solicitud: {exc}") from exc

    return {
        "status": "sent",
        "sample_code": sample_code,
        "seed_lot_code": seed_lot_code,
        "files": [file.filename for file in files],
        "external_response": external_response,
    }


@router.get("/{sample_id}", response_model=SeedSampleRead)
def get_seed_sample(sample_id: UUID, db: Session = Depends(get_db)) -> SeedSample:
    return get_or_404(db, SeedSample, sample_id)


@router.post("/analysis-results", response_model=SeedAnalysisResultRead, status_code=status.HTTP_201_CREATED)
def add_analysis_result(payload: SeedAnalysisResultCreate, db: Session = Depends(get_db)) -> SeedAnalysisResult:
    data = payload.model_dump(exclude_unset=True)
    data.setdefault("analyzed_at", datetime.now(timezone.utc))
    result = SeedAnalysisResult(**data)
    db.add(result)
    db.flush()

    sample = get_or_404(db, SeedSample, result.seed_sample_id)
    campaign = get_or_404(db, CropCampaign, sample.crop_campaign_id)
    campaign.seed_quality_score = result.quality_score
    campaign.seed_quality_category = result.quality_category
    campaign.last_seed_analysis_result_id = result.id
    sample.status = "analyzed"

    db.commit()
    db.refresh(result)
    return result
