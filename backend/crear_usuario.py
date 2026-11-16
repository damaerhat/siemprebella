import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Usuario
from app.security import hash_password


def main():
    username = input("Usuario (ej: admin): ").strip()
    nombre = input("Nombre a mostrar (ej: Juan Musso): ").strip()
    rol = input("Rol [admin/operador] (Enter = admin): ").strip() or "admin"
    if rol not in ("admin", "operador"):
        print("Rol inválido. Usá admin u operador.")
        return
    password = getpass.getpass("Contraseña: ")
    if not username or not password:
        print("Usuario y contraseña son obligatorios.")
        return

    db = SessionLocal()
    try:
        existe = db.scalars(select(Usuario).where(Usuario.username == username)).first()
        if existe:
            print(f"Ya existe el usuario '{username}'.")
            return
        db.add(
            Usuario(
                username=username,
                nombre=nombre or username,
                password_hash=hash_password(password),
                rol=rol,
                activo=True,
            )
        )
        db.commit()
        print(f"Usuario '{username}' creado con rol {rol}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()