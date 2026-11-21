"""Authentication: email+password and Google sign-in, bearer-token sessions, trial and plan.

Only the Python standard library is used for hashing (pbkdf2_hmac), tokens (secrets)
and the Google token check (urllib). Google's tokeninfo endpoint validates the ID token.
"""
import hashlib
import hmac
import json
import secrets
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import Field
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models.entities import AuthSession, User
from app.schemas.api import CamelModel

router = APIRouter(tags=["auth"])

TRIAL_DAYS = 14
PBKDF2_ITERATIONS = 200_000
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class SignupIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8)


class SigninIn(CamelModel):
    email: str
    password: str


class GoogleIn(CamelModel):
    credential: str = Field(min_length=1)


class PlanIn(CamelModel):
    plan: Literal["pro", "free"]


class UserOut(CamelModel):
    id: str
    name: str
    email: str
    created_at: datetime
    trial_ends_at: datetime
    plan: Optional[str] = None


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _user_out(user: User) -> dict:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=_aware(user.created_at),
        trial_ends_at=_aware(user.trial_ends_at),
        plan=user.plan,
    ).model_dump(by_alias=True, mode="json")


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"),
                                 PBKDF2_ITERATIONS).hex()
    return f"{salt}${digest}"


def _verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored or "$" not in stored:
        return False  # Google-only account or malformed value
    salt, expected = stored.split("$", 1)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"),
                                 PBKDF2_ITERATIONS).hex()
    return hmac.compare_digest(digest, expected)


def _new_user(session: Session, *, name: str, email: str, password_hash: Optional[str],
              google_sub: Optional[str]) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        id=uuid.uuid4().hex,
        name=name,
        email=email,
        password_hash=password_hash,
        google_sub=google_sub,
        created_at=now,
        trial_ends_at=now + timedelta(days=TRIAL_DAYS),
        plan=None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _issue_token(session: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    session.add(AuthSession(token=token, user_id=user.id, created_at=datetime.now(timezone.utc)))
    session.commit()
    return token


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):].strip()
    return token or None


def get_current_user(authorization: Optional[str] = Header(default=None),
                     session: Session = Depends(get_session)) -> User:
    token = _bearer_token(authorization)
    if token is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    auth_session = session.get(AuthSession, token)
    if auth_session is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    user = session.get(User, auth_session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return user


def _verify_google_credential(credential: str) -> Optional[dict]:
    """Return the token claims if Google accepts the ID token for our client id, else None."""
    url = GOOGLE_TOKENINFO_URL + "?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            claims = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    if not isinstance(claims, dict):
        return None
    if claims.get("aud") != settings.google_client_id:
        return None
    if not claims.get("sub") or not claims.get("email"):
        return None
    if str(claims.get("email_verified", "")).lower() != "true":
        return None
    return claims


@router.post("/auth/signup")
def signup(body: SignupIn, session: Session = Depends(get_session)):
    email = body.email.strip().lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = _new_user(session, name=body.name.strip(), email=email,
                     password_hash=_hash_password(body.password), google_sub=None)
    token = _issue_token(session, user)
    return {"data": {"token": token, "user": _user_out(user)}}


@router.post("/auth/signin")
def signin(body: SigninIn, session: Session = Depends(get_session)):
    email = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token = _issue_token(session, user)
    return {"data": {"token": token, "user": _user_out(user)}}


@router.post("/auth/google")
def google_signin(body: GoogleIn, session: Session = Depends(get_session)):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server.")
    claims = _verify_google_credential(body.credential)
    if claims is None:
        raise HTTPException(status_code=401, detail="Google sign-in failed.")

    sub = str(claims["sub"])
    email = str(claims["email"]).strip().lower()
    user = session.exec(select(User).where(User.google_sub == sub)).first()
    if user is None:
        user = session.exec(select(User).where(User.email == email)).first()
        if user is not None:
            user.google_sub = sub  # link Google to the existing email account
            session.add(user)
            session.commit()
            session.refresh(user)
    if user is None:
        name = str(claims.get("name") or email.split("@", 1)[0]).strip() or email
        user = _new_user(session, name=name, email=email, password_hash=None, google_sub=sub)

    token = _issue_token(session, user)
    return {"data": {"token": token, "user": _user_out(user)}}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"data": _user_out(user)}


@router.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None),
           session: Session = Depends(get_session)):
    token = _bearer_token(authorization)
    if token:
        auth_session = session.get(AuthSession, token)
        if auth_session is not None:
            session.delete(auth_session)
            session.commit()
    return {"data": None}


@router.post("/auth/plan")
def set_plan(body: PlanIn, user: User = Depends(get_current_user),
             session: Session = Depends(get_session)):
    user.plan = body.plan
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"data": _user_out(user)}
