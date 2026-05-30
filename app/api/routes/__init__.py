from fastapi import APIRouter

from app.api.routes import (
    agent,
    auth,
    campaigns,
    energy,
    health,
    irrigation,
    plots,
    producers,
    seed_samples,
    users,
    weather,
)

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(producers.router, prefix="/producers", tags=["producers"])
router.include_router(plots.router, prefix="/plots", tags=["plots"])
router.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
router.include_router(seed_samples.router, prefix="/seed-samples", tags=["seed samples"])
router.include_router(weather.router, prefix="/weather", tags=["weather"])
router.include_router(irrigation.router, prefix="/irrigation", tags=["irrigation"])
router.include_router(energy.router, prefix="/energy", tags=["energy"])
router.include_router(agent.router, prefix="/agent", tags=["agent"])
 
