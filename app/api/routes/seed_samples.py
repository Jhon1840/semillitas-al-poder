from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from httpx import HTTPError
from starlette.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.integrations.seeddss_client import (
    get_from_external_bytes,
    get_from_external_json,
    post_to_external_json,
    send_seed_images_to_external_service,
)
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
    sample_id: str | None = Form(default=None),
    sample_code: str | None = Form(default=None),
    generated_by: str | None = Form(default=None),
    observations: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="Debes enviar al menos una imagen.")

    invalid_files = [file.filename for file in files if file.content_type and not file.content_type.startswith("image/")]
    if invalid_files:
        raise HTTPException(status_code=400, detail=f"Solo se aceptan imagenes: {', '.join(invalid_files)}")

    try:
        external_response = await send_seed_images_to_external_service(
            files=files,
            sample_id=sample_id or sample_code,
            generated_by=generated_by,
            observations=observations,
            session_id=session_id,
            auth_header=authorization,
        )
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"El servicio externo rechazo la solicitud: {exc}") from exc

    return {
        "status": "sent",
        "sample_id": sample_id or sample_code,
        "generated_by": generated_by,
        "session_id": session_id,
        "external_api_base_url": settings.seeddss_api_url,
        "external_endpoint": f"{settings.seeddss_api_url.rstrip('/')}/api/analyze_group" if settings.seeddss_api_url else None,
        "files": [file.filename for file in files],
        "external_response": external_response,
    }


@router.post("/wizard/start")
async def start_external_seed_wizard(authorization: str | None = Header(default=None)) -> dict:
    try:
        response = await post_to_external_json("/api/start_wizard", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo el inicio del wizard: {exc}") from exc
    return {"status": "started", "external_response": response}


@router.post("/wizard/rollback")
async def rollback_external_seed_wizard(payload: dict, authorization: str | None = Header(default=None)) -> dict:
    try:
        response = await post_to_external_json("/api/rollback_wizard", payload, auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo el rollback: {exc}") from exc
    return {"status": "rolled_back", "external_response": response}


@router.get("/wizard/producer")
async def search_external_seed_producer(cod_or_name: str, authorization: str | None = Header(default=None)) -> dict | list:
    try:
        return await get_from_external_json("/api/get_producer", auth_header=authorization, params={"cod_or_name": cod_or_name})
    except HTTPError as exc:
        raise HTTPException(status_code=404, detail="Productor no encontrado en SeedDSS.") from exc


@router.post("/wizard/producer")
async def save_external_seed_producer(payload: dict, authorization: str | None = Header(default=None)) -> dict:
    try:
        return await post_to_external_json("/api/save_producer", payload, auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo el productor: {exc}") from exc


@router.post("/wizard/lot")
async def save_external_seed_lot(payload: dict, authorization: str | None = Header(default=None)) -> dict:
    try:
        return await post_to_external_json("/api/save_lot", payload, auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo el lote: {exc}") from exc


@router.post("/wizard/sample")
async def save_external_seed_sample(payload: dict, authorization: str | None = Header(default=None)) -> dict:
    try:
        return await post_to_external_json("/api/save_sample", payload, auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo la muestra: {exc}") from exc


@router.post("/wizard/report")
async def save_external_seed_report(payload: dict, authorization: str | None = Header(default=None)) -> dict:
    try:
        return await post_to_external_json("/api/save_report", payload, auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"SeedDSS rechazo el reporte: {exc}") from exc


@router.get("/wizard/overlay-images/{analysis_id}")
async def get_external_overlay_images(analysis_id: str, authorization: str | None = Header(default=None)) -> dict | list:
    try:
        return await get_from_external_json(f"/api/get_overlay_images/{analysis_id}", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudieron cargar las imagenes procesadas: {exc}") from exc


@router.get("/wizard/download-report/{analysis_id}")
async def download_external_seed_report(analysis_id: str, authorization: str | None = Header(default=None)) -> Response:
    try:
        content, content_type = await get_from_external_bytes(f"/api/download_report/{analysis_id}", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo descargar el informe: {exc}") from exc

    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="Reporte_{analysis_id}.pdf"'},
    )


@router.get("/external/lots")
async def list_external_seed_lots(authorization: str | None = Header(default=None)) -> dict | list:
    try:
        return await get_from_external_json("/api/lots", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudieron cargar los lotes de SeedDSS: {exc}") from exc


@router.get("/external/samples")
async def list_external_seed_samples(authorization: str | None = Header(default=None)) -> dict | list:
    try:
        return await get_from_external_json("/api/samples", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudieron cargar las muestras de SeedDSS: {exc}") from exc


@router.get("/external/analyses")
async def list_external_seed_analyses(authorization: str | None = Header(default=None)) -> dict | list:
    try:
        return await get_from_external_json("/api/analyses", auth_header=authorization)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudieron cargar los analisis de SeedDSS: {exc}") from exc


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
