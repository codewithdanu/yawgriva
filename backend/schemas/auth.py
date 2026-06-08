"""
Auth schemas — login, register, token, and user response.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str = Field(..., description="Email pengguna")
    password: str = Field(..., min_length=6, description="Password minimal 6 karakter")


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., description="Email unik")
    phone: Optional[str] = Field(None, max_length=20)
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(farmer|distributor|admin)$")
    region: Optional[str] = Field(None, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    region: Optional[str]
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmerProfileSchema(BaseModel):
    farm_name: Optional[str] = None
    farm_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_area_ha: Optional[float] = None
    commodities: Optional[list] = None

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    region: Optional[str]
    is_verified: bool
    created_at: datetime
    farmer_profile: Optional[FarmerProfileSchema] = None

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    region: Optional[str] = None
    # Farmer profile fields
    farm_name: Optional[str] = None
    farm_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_area_ha: Optional[float] = None
    commodities: Optional[list] = None

