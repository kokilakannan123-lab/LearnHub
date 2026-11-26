
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr

from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, select, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import Base, engine, get_db
from models import User, Course, Lesson, Enrollment, LessonProgress

from schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    LessonCreate,
    LessonUpdate,
    LessonResponse,
    EnrollmentResponse,
    LessonProgressResponse,
    CourseProgressResponse
)

from security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)


# =====================================
# PROFILE UPDATE SCHEMA
# =====================================

class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr


# =====================================
# DATABASE STARTUP
# =====================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("LearnHub database connected successfully!")
    print("LearnHub database tables created successfully!")
    yield


# =====================================
# FASTAPI APPLICATION
# =====================================

app = FastAPI(
    title="LearnHub - Online Learning Management System",
    description="Full Stack Online Learning Platform",
    version="1.0.0",
    lifespan=lifespan
)


# =====================================
# CORS MIDDLEWARE
# =====================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =====================================
# AUTHENTICATION
# =====================================

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(credentials.credentials)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = db.get(User, user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User not found or inactive"
        )

    return user


# =====================================
# INSTRUCTOR ACCESS
# =====================================

def get_current_instructor(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=403,
            detail="Instructor access required"
        )

    return current_user


# =====================================
# STUDENT ACCESS
# =====================================

def get_current_student(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Student access required"
        )

    return current_user


# =====================================
# HOME API
# =====================================

@app.get("/")
def home():
    return {
        "message": "LearnHub Backend Running Successfully!",
        "project": "Online Learning Management System",
        "status": "Active"
    }


# =====================================
# DATABASE CHECK
# =====================================

@app.get("/db-check")
def database_check():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT current_database()")
            )
            database_name = result.scalar()

        return {
            "status": "Connected",
            "database": database_name
        }

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed"
        ) from error


# =====================================
# DATABASE TABLES
# =====================================

@app.get("/tables")
def get_tables():
    table_names = inspect(engine).get_table_names()

    return {
        "message": "Database tables retrieved successfully",
        "total_tables": len(table_names),
        "tables": table_names
    }


# =====================================
# USER REGISTRATION
# =====================================

@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    email = str(user_data.email).lower().strip()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    new_user = User(
        full_name=user_data.full_name.strip(),
        email=email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        ) from error


# =====================================
# USER LOGIN
# =====================================

@app.post(
    "/auth/login",
    response_model=TokenResponse
)
def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    email = str(login_data.email).lower().strip()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not verify_password(
        login_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account is inactive"
        )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# =====================================
# VIEW CURRENT USER PROFILE
# =====================================

@app.get(
    "/auth/me",
    response_model=UserResponse
)
def my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


# =====================================
# UPDATE CURRENT USER PROFILE
# =====================================

@app.put(
    "/auth/me",
    response_model=UserResponse
)
def update_my_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    full_name = profile_data.full_name.strip()
    email = str(profile_data.email).lower().strip()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Name must contain at least 2 characters"
        )

    existing_user = db.scalar(
        select(User).where(
            User.email == email,
            User.id != current_user.id
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered"
        )

    current_user.full_name = full_name
    current_user.email = email

    try:
        db.commit()
        db.refresh(current_user)
        return current_user

    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This email is already registered"
        ) from error

    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update profile"
        ) from error


# =====================================
# CREATE COURSE - INSTRUCTOR
# =====================================

@app.post(
    "/courses",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED
)
def create_course(
    course_data: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    new_course = Course(
        title=course_data.title,
        description=course_data.description,
        category=course_data.category,
        level=course_data.level,
        price=course_data.price,
        instructor_id=current_user.id,
        is_published=False
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return new_course


# =====================================
# VIEW PUBLISHED COURSES - PUBLIC
# =====================================

@app.get(
    "/courses",
    response_model=list[CourseResponse]
)
def get_courses(
    db: Session = Depends(get_db)
):
    return db.scalars(
        select(Course)
        .where(Course.is_published.is_(True))
        .order_by(Course.created_at.desc())
    ).all()


# =====================================
# VIEW OWN COURSES - INSTRUCTOR
# =====================================

@app.get(
    "/courses/my",
    response_model=list[CourseResponse]
)
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    return db.scalars(
        select(Course)
        .where(Course.instructor_id == current_user.id)
        .order_by(Course.created_at.desc())
    ).all()


# =====================================
# VIEW ONE PUBLISHED COURSE
# =====================================

@app.get(
    "/courses/{course_id}",
    response_model=CourseResponse
)
def get_course(
    course_id: int,
    db: Session = Depends(get_db)
):
    course = db.get(Course, course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    return course


# =====================================
# UPDATE COURSE - INSTRUCTOR
# =====================================

@app.put(
    "/courses/{course_id}",
    response_model=CourseResponse
)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    course = db.get(Course, course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot edit another instructor's course"
        )

    update_data = course_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No course details provided"
        )

    for field, value in update_data.items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)

    return course


# =====================================
# DELETE COURSE - INSTRUCTOR
# =====================================

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    course = db.get(Course, course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot delete another instructor's course"
        )

    db.delete(course)
    db.commit()

    return {
        "message": "Course deleted successfully",
        "course_id": course_id
    }


# =====================================
# CREATE LESSON - INSTRUCTOR
# =====================================

@app.post(
    "/courses/{course_id}/lessons",
    response_model=LessonResponse,
    status_code=status.HTTP_201_CREATED
)
def create_lesson(
    course_id: int,
    lesson_data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    course = db.get(Course, course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot add lessons to another instructor's course"
        )

    new_lesson = Lesson(
        course_id=course_id,
        title=lesson_data.title,
        content=lesson_data.content,
        video_url=lesson_data.video_url,
        lesson_order=lesson_data.lesson_order
    )

    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)

    return new_lesson


# =====================================
# VIEW COURSE LESSONS - INSTRUCTOR
# =====================================

@app.get(
    "/courses/{course_id}/lessons",
    response_model=list[LessonResponse]
)
def get_course_lessons(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    course = db.get(Course, course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot view another instructor's lessons"
        )

    return db.scalars(
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.lesson_order, Lesson.id)
    ).all()


# =====================================
# UPDATE LESSON - INSTRUCTOR
# =====================================

@app.put(
    "/lessons/{lesson_id}",
    response_model=LessonResponse
)
def update_lesson(
    lesson_id: int,
    lesson_data: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    lesson = db.get(Lesson, lesson_id)

    if not lesson:
        raise HTTPException(
            status_code=404,
            detail="Lesson not found"
        )

    course = db.get(Course, lesson.course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot edit another instructor's lesson"
        )

    update_data = lesson_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No lesson details provided"
        )

    for field, value in update_data.items():
        setattr(lesson, field, value)

    db.commit()
    db.refresh(lesson)

    return lesson


# =====================================
# DELETE LESSON - INSTRUCTOR
# =====================================

@app.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    lesson = db.get(Lesson, lesson_id)

    if not lesson:
        raise HTTPException(
            status_code=404,
            detail="Lesson not found"
        )

    course = db.get(Course, lesson.course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot delete another instructor's lesson"
        )

    db.delete(lesson)
    db.commit()

    return {
        "message": "Lesson deleted successfully",
        "lesson_id": lesson_id
    }


# =====================================
# STUDENT ENROLLMENT
# =====================================

@app.post(
    "/courses/{course_id}/enroll",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED
)
def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    course = db.get(Course, course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    if course.price > 0:
        raise HTTPException(
            status_code=402,
            detail="Payment required. Paid enrollment is not available yet."
        )

    existing_enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )

    if existing_enrollment:
        raise HTTPException(
            status_code=409,
            detail="Already enrolled in this course"
        )

    new_enrollment = Enrollment(
        student_id=current_user.id,
        course_id=course_id
    )

    try:
        db.add(new_enrollment)
        db.commit()
        db.refresh(new_enrollment)
        return new_enrollment

    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Already enrolled in this course"
        ) from error


# =====================================
# VIEW MY ENROLLED COURSES - STUDENT
# =====================================

@app.get(
    "/enrollments/my",
    response_model=list[EnrollmentResponse]
)
def get_my_enrollments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    return db.scalars(
        select(Enrollment)
        .where(Enrollment.student_id == current_user.id)
        .order_by(Enrollment.enrolled_at.desc())
    ).all()


# =====================================
# VIEW MY COURSE DETAILS - STUDENT
# =====================================

@app.get(
    "/student/courses",
    response_model=list[CourseResponse]
)
def get_student_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    return db.scalars(
        select(Course)
        .join(
            Enrollment,
            Enrollment.course_id == Course.id
        )
        .where(
            Enrollment.student_id == current_user.id,
            Course.is_published.is_(True)
        )
        .order_by(Enrollment.enrolled_at.desc())
    ).all()


# =====================================
# VIEW LESSONS - ENROLLED STUDENT
# =====================================

@app.get(
    "/student/courses/{course_id}/lessons",
    response_model=list[LessonResponse]
)
def get_student_lessons(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    course = db.get(Course, course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )

    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="Please enroll in this course first"
        )

    return db.scalars(
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.lesson_order, Lesson.id)
    ).all()


# =====================================
# MARK LESSON AS COMPLETED
# =====================================

@app.post(
    "/lessons/{lesson_id}/complete",
    response_model=LessonProgressResponse
)
def complete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    lesson = db.get(Lesson, lesson_id)

    if not lesson:
        raise HTTPException(
            status_code=404,
            detail="Lesson not found"
        )

    course = db.get(Course, lesson.course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == lesson.course_id
        )
    )

    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="Please enroll in this course first"
        )

    progress = db.scalar(
        select(LessonProgress).where(
            LessonProgress.student_id == current_user.id,
            LessonProgress.lesson_id == lesson_id
        )
    )

    if not progress:
        progress = LessonProgress(
            student_id=current_user.id,
            lesson_id=lesson_id,
            is_completed=True,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress)

    elif not progress.is_completed:
        progress.is_completed = True
        progress.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)

    return progress


# =====================================
# VIEW STUDENT COURSE PROGRESS
# =====================================

@app.get(
    "/student/courses/{course_id}/progress",
    response_model=CourseProgressResponse
)
def get_course_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    course = db.get(Course, course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )

    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="Please enroll in this course first"
        )

    total_lessons = db.scalar(
        select(func.count(Lesson.id)).where(
            Lesson.course_id == course_id
        )
    ) or 0

    completed_lessons = db.scalar(
        select(func.count(LessonProgress.id))
        .join(
            Lesson,
            Lesson.id == LessonProgress.lesson_id
        )
        .where(
            Lesson.course_id == course_id,
            LessonProgress.student_id == current_user.id,
            LessonProgress.is_completed.is_(True)
        )
    ) or 0

    progress_percentage = (
        round(completed_lessons / total_lessons * 100, 2)
        if total_lessons > 0 else 0.0
    )

    return {
        "course_id": course_id,
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "progress_percentage": progress_percentage
    }


# =====================================
# COURSE COMPLETION CERTIFICATE
# =====================================

@app.get("/student/courses/{course_id}/certificate")
def get_course_certificate(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    course = db.get(Course, course_id)

    if not course or not course.is_published:
        raise HTTPException(
            status_code=404,
            detail="Published course not found"
        )

    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )

    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="You are not enrolled in this course"
        )

    total_lessons = db.scalar(
        select(func.count(Lesson.id)).where(
            Lesson.course_id == course_id
        )
    ) or 0

    completed_lessons = db.scalar(
        select(func.count(func.distinct(Lesson.id)))
        .select_from(Lesson)
        .join(
            LessonProgress,
            LessonProgress.lesson_id == Lesson.id
        )
        .where(
            Lesson.course_id == course_id,
            LessonProgress.student_id == current_user.id,
            LessonProgress.is_completed.is_(True)
        )
    ) or 0

    if total_lessons == 0:
        raise HTTPException(
            status_code=400,
            detail="This course has no lessons"
        )

    if completed_lessons < total_lessons:
        raise HTTPException(
            status_code=400,
            detail="Complete all lessons to receive your certificate"
        )

    completion_date = db.scalar(
        select(func.max(LessonProgress.completed_at))
        .join(
            Lesson,
            Lesson.id == LessonProgress.lesson_id
        )
        .where(
            Lesson.course_id == course_id,
            LessonProgress.student_id == current_user.id,
            LessonProgress.is_completed.is_(True)
        )
    )

    return {
        "message": "Course completed successfully!",
        "certificate_status": "Eligible",
        "student_name": current_user.full_name,
        "course_name": course.title,
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "progress_percentage": 100,
        "completion_date": (
            completion_date.date().isoformat()
            if completion_date else None
        )
    }


# =====================================
# INSTRUCTOR DASHBOARD STATISTICS
# =====================================

@app.get("/instructor/dashboard")
def instructor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    total_courses = db.scalar(
        select(func.count(Course.id)).where(
            Course.instructor_id == current_user.id
        )
    ) or 0

    published_courses = db.scalar(
        select(func.count(Course.id)).where(
            Course.instructor_id == current_user.id,
            Course.is_published.is_(True)
        )
    ) or 0

    draft_courses = total_courses - published_courses

    total_enrollments = db.scalar(
        select(func.count(Enrollment.id))
        .join(Course, Course.id == Enrollment.course_id)
        .where(Course.instructor_id == current_user.id)
    ) or 0

    total_students = db.scalar(
        select(func.count(func.distinct(Enrollment.student_id)))
        .join(Course, Course.id == Enrollment.course_id)
        .where(Course.instructor_id == current_user.id)
    ) or 0

    return {
        "instructor_id": current_user.id,
        "instructor_name": current_user.full_name,
        "total_courses": total_courses,
        "published_courses": published_courses,
        "draft_courses": draft_courses,
        "total_students": total_students,
        "total_enrollments": total_enrollments
    }


# =====================================
# INSTRUCTOR COURSE-WISE STATISTICS
# =====================================

@app.get("/instructor/courses/stats")
def instructor_course_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    courses = db.scalars(
        select(Course)
        .where(Course.instructor_id == current_user.id)
        .order_by(Course.created_at.desc())
    ).all()

    result = []

    for course in courses:
        enrollment_count = db.scalar(
            select(func.count(Enrollment.id)).where(
                Enrollment.course_id == course.id
            )
        ) or 0

        lesson_count = db.scalar(
            select(func.count(Lesson.id)).where(
                Lesson.course_id == course.id
            )
        ) or 0

        result.append({
            "course_id": course.id,
            "course_title": course.title,
            "category": course.category,
            "level": course.level,
            "price": float(course.price or 0),
            "is_published": course.is_published,
            "total_lessons": lesson_count,
            "total_students": enrollment_count
        })

    return result


# =====================================
# VIEW STUDENTS ENROLLED IN A COURSE
# =====================================

@app.get("/instructor/courses/{course_id}/students")
def instructor_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_instructor)
):
    course = db.get(Course, course_id)

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    if course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot view students in another instructor's course"
        )

    total_lessons = db.scalar(
        select(func.count(Lesson.id)).where(
            Lesson.course_id == course_id
        )
    ) or 0

    enrollments = db.execute(
        select(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .where(Enrollment.course_id == course_id)
        .order_by(Enrollment.enrolled_at.desc())
    ).all()

    students = []

    for enrollment, student in enrollments:
        completed_lessons = db.scalar(
            select(func.count(LessonProgress.id))
            .join(
                Lesson,
                Lesson.id == LessonProgress.lesson_id
            )
            .where(
                Lesson.course_id == course_id,
                LessonProgress.student_id == student.id,
                LessonProgress.is_completed.is_(True)
            )
        ) or 0

        percentage = (
            round(completed_lessons / total_lessons * 100, 2)
            if total_lessons > 0 else 0
        )

        students.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "email": student.email,
            "enrolled_at": (
                enrollment.enrolled_at.isoformat()
                if enrollment.enrolled_at else None
            ),
            "completed_lessons": completed_lessons,
            "total_lessons": total_lessons,
            "progress_percentage": percentage
        })

    return {
        "course_id": course.id,
        "course_title": course.title,
        "total_students": len(students),
        "students": students
    }
