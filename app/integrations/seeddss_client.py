from urllib.parse import urljoin

from fastapi import UploadFile
import httpx

from app.core.config import settings


def _base_url() -> str | None:
    return settings.seeddss_api_url.rstrip("/") + "/" if settings.seeddss_api_url else None


def _url(path: str) -> str:
    base = _base_url()
    if not base:
        raise RuntimeError("SEEDDSS_API_URL no esta configurado.")
    return urljoin(base, path.lstrip("/"))


def _auth_headers(auth_header: str | None = None) -> dict[str, str]:
    headers: dict[str, str] = {}
    if settings.seeddss_api_key:
        headers["Authorization"] = f"Bearer {settings.seeddss_api_key}"
    if auth_header:
        token = auth_header.removeprefix("Bearer ").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
    return headers


async def login_to_external_service(email: str, password: str) -> dict:
    if not settings.seeddss_api_url:
        raise RuntimeError("SEEDDSS_API_URL no esta configurado.")

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            _url(settings.seeddss_login_path),
            json={"email": email, "password": password},
        )
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        raise RuntimeError(
            f"SeedDSS respondio {response.status_code} desde {settings.seeddss_login_path}, "
            "pero no devolvio JSON. Confirma que esa ruta sea API y no una pagina HTML."
        )

    data = response.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        raise RuntimeError("SeedDSS no devolvio token de sesion.")
    return {
        "access_token": token,
        "token_type": data.get("token_type", "bearer"),
        "provider": "seeddss-api",
        "user": data.get("user") or {"email": email},
        "raw_response": data,
    }


async def post_to_external_json(path: str, payload: dict | None = None, auth_header: str | None = None) -> dict:
    if not settings.seeddss_api_url:
        raise RuntimeError("SEEDDSS_API_URL no esta configurado.")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(_url(path), json=payload, headers=_auth_headers(auth_header))
        response.raise_for_status()
        if "application/json" in response.headers.get("content-type", ""):
            return response.json()
        return {"status": "success", "raw_response": response.text}


async def get_from_external_json(path: str, auth_header: str | None = None, params: dict | None = None) -> dict | list:
    if not settings.seeddss_api_url:
        raise RuntimeError("SEEDDSS_API_URL no esta configurado.")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(_url(path), params=params, headers=_auth_headers(auth_header))
        response.raise_for_status()
        if "application/json" in response.headers.get("content-type", ""):
            return response.json()
        return {"status": "success", "raw_response": response.text}


async def get_from_external_bytes(path: str, auth_header: str | None = None) -> tuple[bytes, str]:
    if not settings.seeddss_api_url:
        raise RuntimeError("SEEDDSS_API_URL no esta configurado.")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(_url(path), headers=_auth_headers(auth_header))
        response.raise_for_status()
        return response.content, response.headers.get("content-type", "application/octet-stream")


async def send_seed_images_to_external_service(
    files: list[UploadFile],
    sample_id: str | None = None,
    generated_by: str | None = None,
    observations: str | None = None,
    session_id: str | None = None,
    auth_header: str | None = None,
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
        "sample_id": sample_id or "NEXO-SAMPLE",
        "generated_by": generated_by or "NEXO",
        "predicted_class": "",
        "probability": "0",
        "observations": observations or "",
    }
    if session_id:
        data["session_id"] = session_id
    headers = _auth_headers(auth_header)
    analyze_url = _url("/api/analyze_group")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            analyze_url,
            data=data,
            files=multipart_files,
            headers=headers,
        )
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            analysis = response.json()
            analysis["external_endpoint"] = analyze_url
            save_report_response = await _save_report_if_possible(client, analysis, data, headers)
            if save_report_response is not None:
                analysis["save_report_response"] = save_report_response
            return analysis

    return {
        "status": "success",
        "external_endpoint": analyze_url,
        "raw_response": response.text,
    }


async def _save_report_if_possible(
    client: httpx.AsyncClient,
    analysis: dict,
    request_data: dict,
    headers: dict[str, str],
) -> dict | None:
    if not analysis.get("analysis_id") and not analysis.get("predicted_class"):
        return None
    if not request_data.get("session_id"):
        return None

    payload = {
        "session_id": request_data["session_id"],
        "sample_id": request_data["sample_id"],
        "predicted_class": analysis.get("predicted_class", ""),
        "probability": analysis.get("probability", 0),
        "features": analysis.get("features", {}),
        "observations": request_data.get("observations", ""),
    }
    response = await client.post(_url("/api/save_report"), json=payload, headers=headers)
    if response.status_code == 404:
        return {"status": "not_available"}
    response.raise_for_status()
    if "application/json" in response.headers.get("content-type", ""):
        return response.json()
    return {"status": "saved", "raw_response": response.text}
