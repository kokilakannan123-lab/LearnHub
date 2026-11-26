# LearnHub – Online Learning Management System

LearnHub is a full-stack online learning platform built using React, TypeScript, Python FastAPI, and PostgreSQL.

## Features

### Student
- Student registration and login
- Browse available courses
- Enroll in free courses
- View course lessons
- Track lesson completion and progress
- Download course completion certificates

### Instructor
- Instructor registration and login
- Create and manage courses
- Add, edit, and delete lessons
- View enrolled students
- Monitor student progress

## Technologies Used

- Frontend: React, TypeScript, CSS
- Backend: Python, FastAPI
- Database: PostgreSQL
- Authentication: JWT
- ORM: SQLAlchemy
- PDF: jsPDF

## Project Structure

```text
LearnHub/
├── backend/
└── frontend/
```

## How to Run

### Backend

```powershell
cd backend
python -m uvicorn main:app --reload
```

Backend API: http://127.0.0.1:8000

Swagger documentation: http://127.0.0.1:8000/docs

### Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Author

kokilakannan123-lab