from sqlalchemy import select

from app.database import SessionLocal
from app.models import Recurso

RECURSOS = [
    ("Camilla 1", "camilla", 1),
    ("Camilla 2", "camilla", 2),
    ("Camilla 3", "camilla", 3),
    ("Uñas", "unas", 4),
]


def main():
    db = SessionLocal()
    try:
        creados = 0
        for nombre, tipo, orden in RECURSOS:
            if db.scalars(select(Recurso).where(Recurso.nombre == nombre)).first():
                continue
            db.add(Recurso(nombre=nombre, tipo=tipo, orden=orden))
            creados += 1
        db.commit()
        print(f"Recursos creados: {creados}")
    finally:
        db.close()


if __name__ == "__main__":
    main()