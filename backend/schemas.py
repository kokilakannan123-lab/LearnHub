
from typing import Literal
from decimal import Decimal
from datetime import datetime

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict
)


# =====================================
# 1. USER REGISTRATION
# =====================================

class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "instructor"] = "student"


# =====================================
# 2. USER LOGIN
# =====================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# =====================================
# 3. USER RESPONSE
# =====================================

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# =====================================
# 4. LOGIN RESPONSE
# =====================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# =====================================
# 5. COURSE CREATION
# =====================================

class CourseCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    category: str = Field(min_length=2, max_length=100)
    level: str = Field(min_length=2, max_length=50)
    price: Decimal = Field(default=Decimal("0.00"), ge=0)


# =====================================
# 6. COURSE UPDATE
# =====================================

class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, min_length=2, max_length=100)
    level: str | None = Field(default=None, min_length=2, max_length=50)
    price: Decimal | None = Field(default=None, ge=0)
    is_published: bool | None = None


# =====================================
# 7. COURSE RESPONSE
# =====================================

class CourseResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category: str
    level: str
    price: Decimal
    instructor_id: int
    is_published: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================
# 8. LESSON CREATION
# =====================================

class LessonCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    content: str | None = None
    video_url: str | None = Field(default=None, max_length=500)
    lesson_order: int = Field(default=1, ge=1)


# =====================================
# 9. LESSON UPDATE
# =====================================

class LessonUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=3,
        max_length=200
    )

    content: str | None = None

    video_url: str | None = Field(
        default=None,
        max_length=500
    )

    lesson_order: int | None = Field(
        default=None,
        ge=1
    )


# =====================================
# 10. LESSON RESPONSE
# =====================================

class LessonResponse(BaseModel):
    id: int
    course_id: int
    title: str
    content: str | None
    video_url: str | None
    lesson_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================
# 11. ENROLLMENT RESPONSE
# =====================================

class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    enrolled_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================
# 12. LESSON PROGRESS RESPONSE
# =====================================

class LessonProgressResponse(BaseModel):
    id: int
    student_id: int
    lesson_id: int
    is_completed: bool
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


# =====================================
# 13. COURSE PROGRESS RESPONSE
# =====================================

class CourseProgressResponse(BaseModel):
    course_id: int
    total_lessons: int
    completed_lessons: int
    progress_percentage: float
