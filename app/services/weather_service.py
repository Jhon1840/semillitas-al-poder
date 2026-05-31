from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import WeatherSnapshot
from app.schemas.entities import WeatherFetchRequest


async def fetch_open_meteo_snapshot(db: Session, payload: WeatherFetchRequest) -> WeatherSnapshot:
    params = {
        "latitude": float(payload.latitude),
        "longitude": float(payload.longitude),
        "current": "relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max",
        "timezone": "auto",
        "wind_speed_unit": "ms",
        "forecast_days": 1,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(settings.open_meteo_api_url, params=params)
        response.raise_for_status()
        data = response.json()

    daily = data.get("daily", {})
    tmax = (daily.get("temperature_2m_max") or [None])[0]
    tmin = (daily.get("temperature_2m_min") or [None])[0]
    precipitation = (daily.get("precipitation_sum") or [None])[0]
    uv_index = (daily.get("uv_index_max") or [None])[0]
    current = data.get("current", {})
    humidity = current.get("relative_humidity_2m")
    wind_speed = current.get("wind_speed_10m")
    shortwave_radiation = current.get("shortwave_radiation")

    snapshot = WeatherSnapshot(
        crop_campaign_id=payload.crop_campaign_id,
        plot_id=payload.plot_id,
        provider="open_meteo",
        latitude=payload.latitude,
        longitude=payload.longitude,
        forecast_date=payload.forecast_date,
        forecast_type="daily",
        tmin_c=tmin,
        tmax_c=tmax,
        tmean_c=(tmin + tmax) / 2 if tmin is not None and tmax is not None else None,
        precipitation_mm=precipitation,
        humidity_percent=humidity,
        wind_speed_ms=wind_speed,
        solar_radiation_estimate=shortwave_radiation,
        uv_index=uv_index,
        raw_response_json=data,
        fetched_at=datetime.now(timezone.utc),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
