from sqlalchemy import Boolean, Date, DateTime, Float, Integer, inspect
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
from app.models import entities  # noqa: F401  (registers the tables)

def get_database_url() -> str:
    url = settings.database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


db_url = get_database_url()
is_sqlite = db_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}
engine = create_engine(db_url, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    if is_sqlite:
        ensure_columns()
    # Seed default clinic settings and sample data if database is brand new
    with Session(engine) as session:
        from app.services.seed import seed_if_empty
        seed_if_empty(session)


def _all_subclasses(cls) -> list:
    found = []
    for sub in cls.__subclasses__():
        found.append(sub)
        found.extend(_all_subclasses(sub))
    return found


def _sqlite_type(sa_type) -> str:
    if isinstance(sa_type, Boolean):
        return "BOOLEAN"
    if isinstance(sa_type, Integer):
        return "INTEGER"
    if isinstance(sa_type, Float):
        return "REAL"
    return "TEXT"


def _default_clause(model_default, sql_type: str, is_date: bool) -> str:
    """Return the DEFAULT clause (with leading space) for an added column, or '' for none."""
    if isinstance(model_default, bool):
        return f" DEFAULT {1 if model_default else 0}"
    if isinstance(model_default, (int, float)):
        return f" DEFAULT {model_default!r}"
    if isinstance(model_default, str):
        escaped = model_default.replace("'", "''")
        return f" DEFAULT '{escaped}'"
    if is_date:
        return ""  # '' is not a valid date for SQLAlchemy's Date/DateTime; leave NULL
    if sql_type == "TEXT":
        return " DEFAULT ''"
    return " DEFAULT 0"


def ensure_columns() -> None:
    """Non-destructive: ADD COLUMN for model columns missing from existing tables."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    model_by_table = {
        cls.__table__.name: cls
        for cls in _all_subclasses(SQLModel)
        if getattr(cls, "__table__", None) is not None
    }
    preparer = engine.dialect.identifier_preparer
    with engine.begin() as conn:
        for table_name, table in SQLModel.metadata.tables.items():
            if table_name not in existing_tables:
                continue  # create_all handles new tables
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            model_cls = model_by_table.get(table_name)
            fields = model_cls.model_fields if model_cls is not None else {}
            for column in table.columns:
                if column.name in existing_cols:
                    continue
                sql_type = _sqlite_type(column.type)
                is_date = isinstance(column.type, (Date, DateTime))
                field = fields.get(column.name)
                model_default = None
                if field is not None and not field.is_required() and field.default_factory is None:
                    model_default = field.default
                default = _default_clause(model_default, sql_type, is_date)
                sql = (
                    f"ALTER TABLE {preparer.quote(table_name)} "
                    f"ADD COLUMN {preparer.quote(column.name)} {sql_type}{default}"
                )
                conn.exec_driver_sql(sql)
                print(f"[db] added column {table_name}.{column.name} ({sql_type})")


def get_session():
    with Session(engine) as session:
        yield session