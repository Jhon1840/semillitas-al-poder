from fastapi import UploadFile
import httpx

from app.core.config import settings


async def send_seed_images_to_external_service(
    files: list[UploadFile],
    sample_code: str | None = None,
    seed_lot_code: str | None = None,
) -> dict:
    if not settings.seeddss_api_url:
        return {
            "status": "not_configured",
            "message": "SEEDDSS_API_URL no esta configurado. Define la URL del servicio externo en .env.",
            "files_received": [file.filename for file in files],
        }

    multipart_files = []
    for file in files:
        content = await file.read()
        multipart_files.append(
            (
                settings.seeddss_images_field,
                (file.filename or "seed-image.jpg", content, file.content_type or "application/octet-stream"),
            )
        )

    data = {
        "sample_code": sample_code or "",
        "seed_lot_code": seed_lot_code or "",
    }
    headers = {}
    if settings.seeddss_api_key:
        headers["Authorization"] = f"Bearer {settings.seeddss_api_key}"

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            settings.seeddss_api_url,
            data=data,
            files=multipart_files,
            headers=headers,
        )
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.json()

    return {
        "status": "success",
        "raw_response": response.text,
    }

