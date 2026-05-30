from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.entities import Producer, User

DEMO_EMAIL = "demo@nexo.app"
DEMO_PASSWORD = "Nexo1234"
DEMO_NAME = "Usuario Demo NEXO"
DEMO_PHONE = "70000000"
DEMO_PRODUCER_NAME = "Productor Demo"


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        created_user = False
        if not user:
            user = User(
                name=DEMO_NAME,
                email=DEMO_EMAIL,
                password_hash=get_password_hash(DEMO_PASSWORD),
                phone=DEMO_PHONE,
            )
            db.add(user)
            db.flush()
            created_user = True

        producer = db.scalar(select(Producer).where(Producer.user_id == user.id))
        created_producer = False
        if not producer:
            producer = Producer(
                user_id=user.id,
                full_name=DEMO_PRODUCER_NAME,
                email=DEMO_EMAIL,
                phone=DEMO_PHONE,
                department="Santa Cruz",
                municipality="Montero",
                community="Demo",
                address="Creado automaticamente por el seeder",
            )
            db.add(producer)
            created_producer = True

        db.commit()

        action = "creado" if created_user else "ya existia"
        producer_action = "creado" if created_producer else "ya existia"
        print(f"Usuario demo {action}: {DEMO_EMAIL}")
        print(f"Productor demo {producer_action}: {DEMO_PRODUCER_NAME}")
        print(f"Password demo: {DEMO_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
