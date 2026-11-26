
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ==========================================
# 1. USERS TABLE
# ==========================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150), unique=True, index=True, nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(20), default="student", nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    created_courses: Mapped[list["Course"]] = relationship(
        back_populates="instructor",
        foreign_keys="Course.instructor_id"
    )

    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )

    lesson_progress: Mapped[list["LessonProgress"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )


# ==========================================
# 2. COURSES TABLE
# ==========================================

class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    level: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )

    instructor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    instructor: Mapped["User"] = relationship(
        back_populates="created_courses",
        foreign_keys=[instructor_id]
    )

    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan"
    )

    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan"
    )


# ==========================================
# 3. LESSONS TABLE
# ==========================================

class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    content: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    video_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    lesson_order: Mapped[int] = mapped_column(
        Integer, default=1
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    course: Mapped["Course"] = relationship(
        back_populates="lessons"
    )

    progress_records: Mapped[list["LessonProgress"]] = relationship(
        back_populates="lesson",
        cascade="all, delete-orphan"
    )


# ==========================================
# 4. ENROLLMENTS TABLE
# ==========================================

class Enrollment(Base):
    __tablename__ = "enrollments"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "course_id",
            name="uq_student_course"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False
    )

    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    student: Mapped["User"] = relationship(
        back_populates="enrollments"
    )

    course: Mapped["Course"] = relationship(
        back_populates="enrollments"
    )


# ==========================================
# 5. LESSON PROGRESS TABLE
# ==========================================

class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "lesson_id",
            name="uq_student_lesson"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id"), nullable=False
    )

    is_completed: Mapped[bool] = mapped_column(
        Boolean, default=False
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    student: Mapped["User"] = relationship(
        back_populates="lesson_progress"
    )

    lesson: Mapped["Lesson"] = relationship(
        back_populates="progress_records"
    )
