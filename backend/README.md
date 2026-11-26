# LearnHub – Online Learning Management System

LearnHub is a full-stack online learning platform developed using React, TypeScript, Python, FastAPI, and PostgreSQL.

The platform allows students to explore courses, enroll in courses, complete lessons, track learning progress, and download course completion certificates. Instructors can create and manage courses and lessons and monitor student enrollment and progress.

## Features

### Student
- Student registration and login
- Browse published courses
- Enroll in free courses
- View enrolled courses
- Access course lessons
- Mark lessons as completed
- Track course progress
- Download completion certificates

### Instructor
- Instructor registration and login
- Create and manage courses
- Publish courses
- Add, edit, and delete lessons
- View instructor dashboard
- View enrolled students
- Monitor student learning progress

### Security
- JWT-based authentication
- Password hashing
- Role-based access control
- Protected API endpoints

## Technology Stack

**Frontend**
- React
- TypeScript
- CSS

**Backend**
- Python
- FastAPI
- SQLAlchemy

**Database**
- PostgreSQL

**Tools**
- Visual Studio Code
- Git
- GitHub
- Swagger UI

## Project Structure

```text
project3/
│
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── security.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── main.tsx
│   └── package.json
│
└── README.md
```

## How to Run the Project

### 1. Start the Backend

Open PowerShell:

```powershell
cd C:\Users\Best\Desktop\project3\backend
```

Activate your virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

Start FastAPI:

```powershell
python -m uvicorn main:app --reload
```

Backend URL:

http://127.0.0.1:8000

Swagger API documentation:

http://127.0.0.1:8000/docs

### 2. Start the Frontend

Open another PowerShell terminal:

```powershell
cd C:\Users\Best\Desktop\project3\frontend
```

Install dependencies if needed:

```powershell
npm install
```

Start React:

```powershell
npm run dev
```

Frontend URL:

http://localhost:5173

## Testing

The following features have been tested:

- Student and instructor authentication
- Course creation and enrollment
- Lesson management and completion
- Student progress tracking
- Instructor dashboard
- Enrolled student details
- Certificate eligibility
- Logout functionality

## Future Enhancements

- Online payment integration
- Course search and filtering
- Video lesson support
- Email notifications
- Admin management panel

## Author

Developed as a Full Stack Development Project.

## License

This project is created for educational and portfolio purposes.