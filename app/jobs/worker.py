from celery import Celery

from app.core.config import settings

celery_app = Celery("nexo", broker=settings.redis_url, backend=settings.redis_url)


@celery_app.task(name="nexo.ping")
def ping() -> str:
    return "pong"

