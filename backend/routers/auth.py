"""
Auth router — login, register, logout, and current user.
JWT tokens are returned for Bearer auth.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from models.user import User
from models.batch import FarmerProfile
from schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user. Returns JWT token immediately."""
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == request.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar",
        )

    user = User(
        name=request.name,
        email=request.email,
        phone=request.phone,
        role=request.role,
        hashed_pw=hash_password(request.password),
        region=request.region,
    )
    db.add(user)
    await db.flush()

    # If farmer, create empty profile
    if request.role == "farmer":
        profile = FarmerProfile(user_id=user.id)
        db.add(profile)

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and return JWT token."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
async def logout():
    """Logout — client-side token removal. Stateless JWT."""
    return {"message": "Logout berhasil. Hapus token di sisi client."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user profile."""
    return UserResponse.model_validate(current_user)


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full user profile with farmer details."""
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.farmer_profile))
    )
    user = result.scalar_one()
    return user


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    request: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile and farmer specific profile details."""
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.farmer_profile))
    )
    user = result.scalar_one()

    # Update basic user fields
    if request.name is not None:
        user.name = request.name
    if request.phone is not None:
        user.phone = request.phone
    if request.region is not None:
        user.region = request.region

    # Update farmer/distributor-specific profile fields
    if user.role in ("farmer", "distributor"):
        if not user.farmer_profile:
            user.farmer_profile = FarmerProfile(user_id=user.id)
            db.add(user.farmer_profile)

        if request.farm_name is not None:
            user.farmer_profile.farm_name = request.farm_name
        if request.farm_address is not None:
            user.farmer_profile.farm_address = request.farm_address
        if request.latitude is not None:
            user.farmer_profile.latitude = request.latitude
        if request.longitude is not None:
            user.farmer_profile.longitude = request.longitude
        if request.land_area_ha is not None:
            user.farmer_profile.land_area_ha = request.land_area_ha
        if request.commodities is not None:
            user.farmer_profile.commodities = request.commodities

    await db.commit()
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.farmer_profile))
    )
    user = result.scalar_one()
    return user


