
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API = "http://127.0.0.1:8000";

type Role = "student" | "instructor";

interface User {
  id: number;
  name?: string;
  full_name?: string;
  email: string;
  role: Role;
}

interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  instructor_id?: number;
  is_published?: boolean;
}

interface Lesson {
  id: number;
  title: string;
  content: string;
  lesson_order?: number;
  order?: number;
}

interface Progress {
  completed_lessons?: number;
  total_lessons?: number;
  progress_percentage?: number;
  percentage?: number;
}

interface Certificate {
  message: string;
  certificate_status: string;
  student_name: string;
  course_name: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  completion_date: string | null;
}

interface ProfileCourseProgress {
  courseId: number;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
}

interface InstructorDashboard {
  instructor_id: number;
  instructor_name: string;
  total_courses: number;
  published_courses: number;
  draft_courses: number;
  total_students: number;
  total_enrollments: number;
}

interface InstructorCourseStat {
  course_id: number;
  course_title: string;
  category: string;
  level: string;
  price: number;
  is_published: boolean;
  total_lessons: number;
  total_students: number;
}

interface EnrolledStudent {
  student_id: number;
  student_name: string;
  email: string;
  enrolled_at: string;
  completed_lessons: number;
  total_lessons: number;
  progress_percentage: number;
}

interface CourseStudents {
  course_id: number;
  course_title: string;
  total_students: number;
  students: EnrolledStudent[];
}

function App() {
  const [page, setPage] = useState<
    "home" | "login" | "register" | "dashboard"
  >("home");

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState(
    localStorage.getItem("learnhub_token") || ""
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedCourse, setSelectedCourse] =
    useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] =
    useState<Lesson | null>(null);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);

  const [certificate, setCertificate] =
    useState<Certificate | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);

  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [profileProgress, setProfileProgress] =
    useState<ProfileCourseProgress[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Instructor dashboard
  const [instructorDashboard, setInstructorDashboard] =
    useState<InstructorDashboard | null>(null);

  const [instructorCourseStats, setInstructorCourseStats] =
    useState<InstructorCourseStat[]>([]);

  const [courseStudents, setCourseStudents] =
    useState<CourseStudents | null>(null);

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  const [selectedStudentsCourseId, setSelectedStudentsCourseId] =
    useState<number | null>(null);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All Categories");

  // Authentication fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");

  // Course form
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseCategory, setCourseCategory] =
    useState("Web Development");
  const [courseLevel, setCourseLevel] = useState("Beginner");
  const [coursePrice, setCoursePrice] = useState("0");
  const [editingCourseId, setEditingCourseId] =
    useState<number | null>(null);

  // Lesson form
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName =
    user?.name || user?.full_name || user?.email || "User";

  // API helper
  async function apiRequest(
    path: string,
    method = "GET",
    body?: unknown
  ) {
    const activeToken =
      localStorage.getItem("learnhub_token") || token;

    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(activeToken
          ? { Authorization: `Bearer ${activeToken}` }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
          data.message ||
          `Request failed (${response.status})`
      );
    }

    return data;
  }

  function clearMessages() {
    setMessage("");
    setError("");
  }

  // Load student or instructor dashboard
  async function loadDashboard(currentUser: User) {
    try {
      if (currentUser.role === "student") {
        const data = await apiRequest("/student/courses");
        setCourses(Array.isArray(data) ? data : []);
      } else {
        const [coursesData, dashboardData, statsData] =
          await Promise.all([
            apiRequest("/courses/my"),
            apiRequest("/instructor/dashboard"),
            apiRequest("/instructor/courses/stats"),
          ]);

        setMyCourses(
          Array.isArray(coursesData) ? coursesData : []
        );

        setInstructorDashboard(dashboardData);

        setInstructorCourseStats(
          Array.isArray(statsData) ? statsData : []
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load dashboard."
      );
    }
  }

  // Load enrolled students
  async function viewCourseStudents(courseId: number) {
    clearMessages();
    setStudentsError("");

    setSelectedStudentsCourseId(courseId);
    setCourseStudents(null);
    setStudentsLoading(true);

    try {
      const data = await apiRequest(
        `/instructor/courses/${courseId}/students`
      );

      const result: CourseStudents = {
        course_id: data.course_id,
        course_title: data.course_title,
        total_students: data.total_students,
        students: Array.isArray(data.students)
          ? data.students
          : [],
      };

      setCourseStudents(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Could not load enrolled students.";

      setStudentsError(errorMessage);
      setError(errorMessage);
    } finally {
      setStudentsLoading(false);
    }
  }

  // Automatically scroll to the student results
  useEffect(() => {
    if (
      selectedStudentsCourseId !== null &&
      !studentsLoading
    ) {
      document
        .getElementById("enrolled-students-section")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }, [selectedStudentsCourseId, studentsLoading]);

  // Student profile
  async function openStudentProfile() {
    if (!user || user.role !== "student") return;

    clearMessages();
    setShowStudentProfile(true);
    setProfileLoading(true);
    setProfileProgress([]);

    try {
      const results = await Promise.all(
        courses.map(async (course) => {
          const data = await apiRequest(
            `/student/courses/${course.id}/progress`
          );

          return {
            courseId: course.id,
            courseTitle: course.title,
            completedLessons: data.completed_lessons ?? 0,
            totalLessons: data.total_lessons ?? 0,
            percentage:
              data.progress_percentage ?? data.percentage ?? 0,
          };
        })
      );

      setProfileProgress(results);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load profile progress."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  // Restore login session
  useEffect(() => {
    async function restoreSession() {
      const savedToken =
        localStorage.getItem("learnhub_token");

      if (!savedToken) return;

      try {
        const response = await fetch(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem("learnhub_token");
          setToken("");
          return;
        }

        const currentUser: User = await response.json();

        setToken(savedToken);
        setUser(currentUser);
        setPage("dashboard");

        await loadDashboard(currentUser);
      } catch {
        localStorage.removeItem("learnhub_token");
        setToken("");
      }
    }

    restoreSession();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login and registration
  async function handleAuth(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (page === "register") {
        await apiRequest("/auth/register", "POST", {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        });

        setMessage(
          "Registration successful. Please log in."
        );

        setPage("login");
        setPassword("");
      } else {
        const data = await apiRequest(
          "/auth/login",
          "POST",
          {
            email: email.trim().toLowerCase(),
            password,
          }
        );

        const receivedToken =
          data.access_token ||
          data.token ||
          data.accessToken;

        if (!receivedToken) {
          throw new Error(
            "Login succeeded but no access token was returned."
          );
        }

        localStorage.setItem(
          "learnhub_token",
          receivedToken
        );

        setToken(receivedToken);

        const response = await fetch(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${receivedToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            "Could not load your account information."
          );
        }

        const currentUser: User = await response.json();

        setUser(currentUser);
        setPage("dashboard");
        setPassword("");
        setMessage("Logged in successfully!");

        await loadDashboard(currentUser);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // Logout
  function logout() {
    localStorage.removeItem("learnhub_token");

    setToken("");
    setUser(null);
    setCourses([]);
    setMyCourses([]);
    setLessons([]);
    setSelectedCourse(null);
    setSelectedLesson(null);
    setProgress(null);
    setCompletedLessons([]);
    setCertificate(null);
    setEditingCourseId(null);
    setShowStudentProfile(false);
    setProfileProgress([]);
    setInstructorDashboard(null);
    setInstructorCourseStats([]);
    setCourseStudents(null);
    setSelectedStudentsCourseId(null);
    setStudentsError("");
    setSearchTerm("");
    setSelectedCategory("All Categories");
    setPage("home");

    clearMessages();
  }

  // Public courses
  async function loadPublicCourses() {
    clearMessages();

    try {
      const data = await apiRequest("/courses");
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load courses."
      );
    }
  }

  // Create course
  async function createCourse(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearMessages();

    try {
      await apiRequest("/courses", "POST", {
        title: courseTitle.trim(),
        description: courseDescription.trim(),
        category: courseCategory,
        level: courseLevel,
        price: Number(coursePrice),
      });

      setCourseTitle("");
      setCourseDescription("");
      setCourseCategory("Web Development");
      setCourseLevel("Beginner");
      setCoursePrice("0");

      setMessage("Course created successfully.");

      if (user) await loadDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create course."
      );
    }
  }

  // Edit course
  function startEditCourse(course: Course) {
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDescription(course.description);
    setCourseCategory(course.category);
    setCourseLevel(course.level);
    setCoursePrice(String(course.price));

    clearMessages();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditCourse() {
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setCourseCategory("Web Development");
    setCourseLevel("Beginner");
    setCoursePrice("0");
    clearMessages();
  }

  async function updateCourse(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (editingCourseId === null) return;

    clearMessages();

    try {
      const existingCourse = myCourses.find(
        (course) => course.id === editingCourseId
      );

      await apiRequest(
        `/courses/${editingCourseId}`,
        "PUT",
        {
          title: courseTitle.trim(),
          description: courseDescription.trim(),
          category: courseCategory,
          level: courseLevel,
          price: Number(coursePrice),
          is_published:
            existingCourse?.is_published ?? false,
        }
      );

      setMessage("Course updated successfully!");
      setEditingCourseId(null);
      setCourseTitle("");
      setCourseDescription("");
      setCourseCategory("Web Development");
      setCourseLevel("Beginner");
      setCoursePrice("0");

      if (user) await loadDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update course."
      );
    }
  }

  // Publish and unpublish
  async function togglePublish(course: Course) {
    clearMessages();

    try {
      await apiRequest(`/courses/${course.id}`, "PUT", {
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        price: course.price,
        is_published: !course.is_published,
      });

      setMessage(
        course.is_published
          ? "Course unpublished."
          : "Course published."
      );

      if (user) await loadDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update course."
      );
    }
  }

  // Delete course
  async function deleteCourse(courseId: number) {
    if (
      !window.confirm(
        "Are you sure you want to delete this course?"
      )
    ) {
      return;
    }

    clearMessages();

    try {
      await apiRequest(`/courses/${courseId}`, "DELETE");

      setMessage("Course deleted successfully.");

      if (user) await loadDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete course."
      );
    }
  }

  // Open course and lessons
  async function openCourse(course: Course) {
    clearMessages();

    setSelectedCourse(course);
    setSelectedLesson(null);
    setLessons([]);
    setProgress(null);
    setCompletedLessons([]);
    setCertificate(null);
    setShowStudentProfile(false);

    setSelectedStudentsCourseId(null);
    setCourseStudents(null);

    try {
      let lessonData: Lesson[];

      if (user?.role === "student") {
        lessonData = await apiRequest(
          `/student/courses/${course.id}/lessons`
        );
      } else {
        lessonData = await apiRequest(
          `/courses/${course.id}/lessons`
        );
      }

      const sortedLessons = (
        Array.isArray(lessonData) ? lessonData : []
      ).sort(
        (a, b) =>
          (a.lesson_order ?? a.order ?? 0) -
          (b.lesson_order ?? b.order ?? 0)
      );

      setLessons(sortedLessons);

      if (user?.role === "student") {
        try {
          const progressData = await apiRequest(
            `/student/courses/${course.id}/progress`
          );

          setProgress(progressData);
        } catch {
          setProgress(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open course."
      );
    }
  }

  // Enroll in course
  async function enrollCourse(course: Course) {
    clearMessages();

    if (Number(course.price) > 0) {
      setError(
        "This course is paid. Payment is not available yet."
      );
      return;
    }

    try {
      await apiRequest(
        `/courses/${course.id}/enroll`,
        "POST"
      );

      setMessage("You have enrolled successfully!");

      if (user) await loadDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Enrollment failed."
      );
    }
  }

  // Add lesson
  async function addLesson(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedCourse) return;

    clearMessages();

    try {
      await apiRequest(
        `/courses/${selectedCourse.id}/lessons`,
        "POST",
        {
          title: lessonTitle.trim(),
          content: lessonContent.trim(),
          lesson_order: lessons.length + 1,
        }
      );

      setLessonTitle("");
      setLessonContent("");
      setMessage("Lesson added successfully.");

      await openCourse(selectedCourse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add lesson."
      );
    }
  }

  // Delete lesson
  async function deleteLesson(lessonId: number) {
    if (!window.confirm("Delete this lesson?")) return;

    clearMessages();

    try {
      await apiRequest(
        `/lessons/${lessonId}`,
        "DELETE"
      );

      setMessage("Lesson deleted successfully.");

      if (selectedCourse) {
        await openCourse(selectedCourse);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete lesson."
      );
    }
  }

  // Complete lesson
  async function completeLesson(lesson: Lesson) {
    clearMessages();

    try {
      await apiRequest(
        `/lessons/${lesson.id}/complete`,
        "POST"
      );

      setCompletedLessons((previous) =>
        previous.includes(lesson.id)
          ? previous
          : [...previous, lesson.id]
      );

      setMessage("Lesson marked as completed.");

      if (selectedCourse) {
        try {
          const progressData = await apiRequest(
            `/student/courses/${selectedCourse.id}/progress`
          );

          setProgress(progressData);
        } catch {
          // Completion confirmation remains visible.
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not complete lesson."
      );
    }
  }

  // Get certificate
  async function getCertificate() {
    if (!selectedCourse) return;

    clearMessages();
    setCertificateLoading(true);

    try {
      const data = await apiRequest(
        `/student/courses/${selectedCourse.id}/certificate`
      );

      setCertificate(data as Certificate);
      setMessage(
        "Certificate eligibility verified successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve certificate."
      );
    } finally {
      setCertificateLoading(false);
    }
  }

  // Download certificate PDF
  function downloadCertificate() {
    if (!certificate) return;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setDrawColor(30, 64, 120);
    pdf.setLineWidth(2);
    pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

    pdf.setDrawColor(190, 150, 60);
    pdf.setLineWidth(0.7);
    pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

    pdf.setTextColor(30, 64, 120);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(30);
    pdf.text("LEARNHUB", pageWidth / 2, 42, {
      align: "center",
    });

    pdf.setTextColor(65, 65, 65);
    pdf.setFontSize(24);
    pdf.text(
      "CERTIFICATE OF COMPLETION",
      pageWidth / 2,
      62,
      { align: "center" }
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(14);
    pdf.text(
      "This certificate is proudly presented to",
      pageWidth / 2,
      83,
      { align: "center" }
    );

    pdf.setTextColor(30, 64, 120);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    pdf.text(certificate.student_name, pageWidth / 2, 101, {
      align: "center",
    });

    pdf.setTextColor(65, 65, 65);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(14);
    pdf.text(
      "for successfully completing the course",
      pageWidth / 2,
      119,
      { align: "center" }
    );

    pdf.setTextColor(30, 64, 120);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(21);
    pdf.text(certificate.course_name, pageWidth / 2, 137, {
      align: "center",
    });

    pdf.setTextColor(65, 65, 65);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);

    pdf.text(
      `${certificate.completed_lessons} of ${certificate.total_lessons} lessons completed - ${certificate.progress_percentage}%`,
      pageWidth / 2,
      153,
      { align: "center" }
    );

    pdf.text(
      `Completion date: ${certificate.completion_date || "Not available"}`,
      pageWidth / 2,
      166,
      { align: "center" }
    );

    pdf.setFontSize(10);
    pdf.text(
      "LearnHub Online Learning Management System",
      pageWidth / 2,
      185,
      { align: "center" }
    );

    const safeCourseName = certificate.course_name
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();

    pdf.save(
      `LearnHub-Certificate-${safeCourseName}.pdf`
    );
  }

  function backToLessons() {
    setSelectedLesson(null);
    clearMessages();
  }

  function backToDashboard() {
    setSelectedCourse(null);
    setSelectedLesson(null);
    setLessons([]);
    setProgress(null);
    setCertificate(null);
    setShowStudentProfile(false);
    setSelectedStudentsCourseId(null);
    setCourseStudents(null);
    setStudentsError("");
    clearMessages();

    if (user) loadDashboard(user);
  }

  // Format lesson content
  function formatLessonContent(content: string) {
    if (!content) return [];

    return content
      .replace(/\\n/g, "\n")
      .replace(/\s+(?=\d+\.\s)/g, "\n\n")
      .replace(/\s+(?=Examples?:)/gi, "\n\n")
      .replace(/\s+(?=Conclusion)/gi, "\n\n")
      .replace(/\s+(?=<\/?[a-z])/gi, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // Render lesson content
  function renderLessonContent(content: string) {
    const lines = formatLessonContent(content);
    const elements: ReactNode[] = [];
    let codeLines: string[] = [];

    function flushCode() {
      if (codeLines.length > 0) {
        elements.push(
          <pre
            className="lesson-code"
            key={`code-${elements.length}`}
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );

        codeLines = [];
      }
    }

    lines.forEach((line, index) => {
      const cleanLine = line
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

      if (
        cleanLine.startsWith("<") ||
        cleanLine.startsWith("</") ||
        cleanLine.startsWith("<!")
      ) {
        codeLines.push(cleanLine);
        return;
      }

      flushCode();

      if (/^\d+\.\s/.test(cleanLine)) {
        elements.push(
          <h2
            className="lesson-section-heading"
            key={`heading-${index}`}
          >
            {cleanLine}
          </h2>
        );
      } else if (/^(Example|Examples):?$/i.test(cleanLine)) {
        elements.push(
          <h3
            className="lesson-example-heading"
            key={`example-${index}`}
          >
            {cleanLine}
          </h3>
        );
      } else {
        elements.push(
          <p key={`paragraph-${index}`}>{cleanLine}</p>
        );
      }
    });

    flushCode();
    return elements;
  }

  const progressPercent =
    progress?.progress_percentage ??
    progress?.percentage ??
    (progress?.total_lessons
      ? Math.round(
          ((progress.completed_lessons || 0) /
            progress.total_lessons) *
            100
        )
      : 0);

  const categories = [
    "All Categories",
    ...Array.from(
      new Set(
        courses
          .map((course) => course.category)
          .filter(Boolean)
      )
    ).sort(),
  ];

  const filteredCourses = courses.filter((course) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      course.title.toLowerCase().includes(search) ||
      course.description.toLowerCase().includes(search) ||
      course.category.toLowerCase().includes(search);

    const matchesCategory =
      selectedCategory === "All Categories" ||
      course.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="app">
      <header className="header">
        <div
          className="logo"
          onClick={() => setPage("home")}
        >
          LearnHub
        </div>

        <nav>
          {user ? (
            <>
              <button onClick={backToDashboard}>
                Dashboard
              </button>

              <button
                onClick={() => {
                  setShowStudentProfile(false);
                  setSelectedCourse(null);
                  setSelectedLesson(null);
                  setSelectedStudentsCourseId(null);
                  setCourseStudents(null);
                  setStudentsError("");
                  setPage("dashboard");
                  loadDashboard(user);
                }}
              >
                Courses
              </button>

              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <button onClick={() => setPage("home")}>
                Home
              </button>

              <button onClick={() => setPage("login")}>
                Login
              </button>

              <button
                className="nav-register"
                onClick={() => setPage("register")}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        {message && (
          <div className="success-message">{message}</div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* HOME PAGE */}
        {page === "home" && (
          <>
            <section className="hero">
              <span className="hero-label">
                WELCOME TO LEARNHUB
              </span>

              <h1>Keep learning every day!</h1>

              <p>
                Learn new skills, explore online courses and
                improve your knowledge with LearnHub.
              </p>

              <div className="hero-buttons">
                <button
                  className="primary-btn"
                  onClick={() => setPage("register")}
                >
                  Get Started
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => {
                    setPage("login");
                    clearMessages();
                  }}
                >
                  Login
                </button>
              </div>
            </section>

            <section className="features">
              <h2>Why Learn with LearnHub?</h2>

              <div className="feature-grid">
                <article className="feature-card">
                  <div className="feature-icon">📚</div>
                  <h3>Online Courses</h3>
                  <p>
                    Explore courses and learn at your own pace.
                  </p>
                </article>

                <article className="feature-card">
                  <div className="feature-icon">🎓</div>
                  <h3>Learn New Skills</h3>
                  <p>
                    Build your knowledge with structured lessons.
                  </p>
                </article>

                <article className="feature-card">
                  <div className="feature-icon">📈</div>
                  <h3>Track Progress</h3>
                  <p>
                    Keep track of the lessons you complete.
                  </p>
                </article>
              </div>
            </section>
          </>
        )}

        {/* LOGIN AND REGISTER */}
        {(page === "login" || page === "register") && (
          <section className="auth-container">
            <div className="auth-card">
              <div className="auth-logo">L</div>

              <h2>
                {page === "login"
                  ? "Welcome Back"
                  : "Create Account"}
              </h2>

              <p>
                {page === "login"
                  ? "Log in to continue learning."
                  : "Register to start using LearnHub."}
              </p>

              <form onSubmit={handleAuth}>
                {page === "register" && (
                  <label>
                    Full Name
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      required
                    />
                  </label>
                )}

                <label>
                  Email Address
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                  />
                </label>

                {page === "register" && (
                  <label>
                    Register As
                    <select
                      value={role}
                      onChange={(e) =>
                        setRole(e.target.value as Role)
                      }
                    >
                      <option value="student">Student</option>
                      <option value="instructor">
                        Instructor
                      </option>
                    </select>
                  </label>
                )}

                <button
                  className="primary-btn full-btn"
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : page === "login"
                      ? "Login"
                      : "Register"}
                </button>
              </form>

              <p className="auth-switch">
                {page === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}

                <button
                  onClick={() => {
                    clearMessages();
                    setPage(
                      page === "login" ? "register" : "login"
                    );
                  }}
                >
                  {page === "login" ? " Register" : " Login"}
                </button>
              </p>
            </div>
          </section>
        )}

        {/* DASHBOARD */}
        {page === "dashboard" && user && (
          <section className="dashboard">
            <div className="dashboard-header">
              <div>
                <span className="eyebrow">
                  LEARNHUB DASHBOARD
                </span>

                <h1>Welcome back, {displayName}</h1>
                <p className="role-text">{user.role}</p>
              </div>

              <div className="dashboard-actions">
                {user.role === "student" && (
                  <button
                    className="secondary-btn"
                    onClick={openStudentProfile}
                  >
                    My Profile
                  </button>
                )}

                <div className="avatar">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* STUDENT PROFILE */}
            {!selectedCourse &&
              user.role === "student" &&
              showStudentProfile && (
                <section className="student-profile">
                  <button
                    className="back-btn"
                    onClick={() => {
                      setShowStudentProfile(false);
                      clearMessages();
                    }}
                  >
                    ← Back to Courses
                  </button>

                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        STUDENT ACCOUNT
                      </span>

                      <h2>My Profile</h2>

                      <p>
                        Your personal details and learning
                        achievements.
                      </p>
                    </div>
                  </div>

                  <div className="profile-card">
                    <div className="avatar">
                      {displayName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h2>{displayName}</h2>
                      <p>{user.email}</p>
                      <span className="role-text">
                        Student
                      </span>
                    </div>
                  </div>

                  {profileLoading ? (
                    <div className="empty-message">
                      Loading your learning progress...
                    </div>
                  ) : (
                    <>
                      <div className="profile-stats">
                        <article className="profile-stat-card">
                          <h3>{courses.length}</h3>
                          <p>Enrolled Courses</p>
                        </article>

                        <article className="profile-stat-card">
                          <h3>
                            {
                              profileProgress.filter(
                                (item) =>
                                  item.totalLessons > 0 &&
                                  item.percentage >= 100
                              ).length
                            }
                          </h3>
                          <p>Completed Courses</p>
                        </article>
                      </div>

                      <div className="profile-courses">
                        <h2>My Learning Progress</h2>

                        {profileProgress.map((item) => (
                          <article
                            className="profile-progress-card"
                            key={item.courseId}
                          >
                            <h3>{item.courseTitle}</h3>

                            <div className="progress-title">
                              <span>
                                {item.completedLessons} of{" "}
                                {item.totalLessons} lessons
                                completed
                              </span>

                              <strong>
                                {item.percentage}%
                              </strong>
                            </div>

                            <div className="progress-container">
                              <div
                                className="progress-bar"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      item.percentage
                                    )
                                  )}%`,
                                }}
                              />
                            </div>

                            {item.totalLessons > 0 &&
                            item.percentage >= 100 ? (
                              <p className="profile-completed">
                                ✓ Course completed — Certificate
                                available
                              </p>
                            ) : (
                              <p>
                                Keep learning to complete this
                                course.
                              </p>
                            )}
                          </article>
                        ))}

                        {profileProgress.length === 0 && (
                          <div className="empty-message">
                            No enrolled course progress found.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

            {/* STUDENT COURSES */}
            {!selectedCourse &&
              user.role === "student" &&
              !showStudentProfile && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>My Courses</h2>
                      <p>
                        Continue learning from your enrolled
                        courses.
                      </p>
                    </div>

                    <button
                      className="secondary-btn"
                      onClick={() =>
                        user && loadDashboard(user)
                      }
                    >
                      Refresh Courses
                    </button>
                  </div>

                  <div className="course-filters">
                    <input
                      type="text"
                      className="course-search"
                      placeholder="Search courses by title or description..."
                      value={searchTerm}
                      onChange={(e) =>
                        setSearchTerm(e.target.value)
                      }
                    />

                    <select
                      className="category-filter"
                      value={selectedCategory}
                      onChange={(e) =>
                        setSelectedCategory(e.target.value)
                      }
                    >
                      {categories.map((category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      ))}
                    </select>

                    <button
                      className="secondary-btn"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCategory("All Categories");
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>

                  <div className="course-grid">
                    {filteredCourses.map((course) => (
                      <article
                        className="course-card"
                        key={course.id}
                      >
                        <div className="course-card-icon">
                          📘
                        </div>

                        <span className="course-category">
                          {course.category}
                        </span>

                        <h3>{course.title}</h3>
                        <p>{course.description}</p>

                        <div className="course-meta">
                          <span>{course.level}</span>

                          <strong>
                            {Number(course.price) === 0
                              ? "Free"
                              : `₹${course.price}`}
                          </strong>
                        </div>

                        <button
                          className="primary-btn full-btn"
                          onClick={() => openCourse(course)}
                        >
                          Open Course
                        </button>
                      </article>
                    ))}
                  </div>

                  {filteredCourses.length === 0 && (
                    <div className="empty-message">
                      {courses.length === 0
                        ? "No enrolled courses found."
                        : "No matching courses found. Try another search or category."}
                    </div>
                  )}
                </>
              )}

            {/* INSTRUCTOR DASHBOARD */}
            {!selectedCourse &&
              user.role === "instructor" && (
                <>
                  {/* STATISTICS */}
                  <section className="instructor-statistics">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          OVERVIEW
                        </span>

                        <h2>Instructor Overview</h2>

                        <p>
                          Track your courses and student
                          enrollment.
                        </p>
                      </div>

                      <button
                        className="secondary-btn"
                        onClick={() =>
                          user && loadDashboard(user)
                        }
                      >
                        Refresh Statistics
                      </button>
                    </div>

                    <div className="instructor-stat-grid">
                      <article className="instructor-stat-card">
                        <div className="instructor-stat-icon">
                          📚
                        </div>
                        <h3>
                          {instructorDashboard?.total_courses ?? 0}
                        </h3>
                        <p>Total Courses</p>
                      </article>

                      <article className="instructor-stat-card">
                        <div className="instructor-stat-icon">
                          🌐
                        </div>
                        <h3>
                          {instructorDashboard?.published_courses ?? 0}
                        </h3>
                        <p>Published Courses</p>
                      </article>

                      <article className="instructor-stat-card">
                        <div className="instructor-stat-icon">
                          📝
                        </div>
                        <h3>
                          {instructorDashboard?.draft_courses ?? 0}
                        </h3>
                        <p>Draft Courses</p>
                      </article>

                      <article className="instructor-stat-card">
                        <div className="instructor-stat-icon">
                          👨‍🎓
                        </div>
                        <h3>
                          {instructorDashboard?.total_students ?? 0}
                        </h3>
                        <p>Total Students</p>
                      </article>
                    </div>

                    <div className="instructor-enrollment-summary">
                      <span>Total Enrollments</span>
                      <strong>
                        {instructorDashboard?.total_enrollments ?? 0}
                      </strong>
                    </div>
                  </section>

                  {/* COURSE PERFORMANCE */}
                  <section className="instructor-course-statistics">
                    <div className="section-heading">
                      <div>
                        <h2>Course Performance</h2>
                        <p>
                          View lessons and student enrollment for
                          each course.
                        </p>
                      </div>
                    </div>

                    <div className="instructor-performance-grid">
                      {instructorCourseStats.map((stat) => (
                        <article
                          className="instructor-performance-card"
                          key={stat.course_id}
                        >
                          <div className="performance-card-header">
                            <div className="course-card-icon">
                              📘
                            </div>

                            <span
                              className={
                                stat.is_published
                                  ? "status-published"
                                  : "status-draft"
                              }
                            >
                              {stat.is_published
                                ? "Published"
                                : "Draft"}
                            </span>
                          </div>

                          <h3>{stat.course_title}</h3>

                          <p>
                            {stat.category} · {stat.level}
                          </p>

                          <div className="performance-details">
                            <div>
                              <span>Total Lessons</span>
                              <strong>
                                {stat.total_lessons}
                              </strong>
                            </div>

                            <div>
                              <span>Enrolled Students</span>
                              <strong>
                                {stat.total_students}
                              </strong>
                            </div>

                            <div>
                              <span>Course Price</span>
                              <strong>
                                {Number(stat.price) === 0
                                  ? "Free"
                                  : `₹${stat.price}`}
                              </strong>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="primary-btn full-btn"
                            onClick={() =>
                              viewCourseStudents(stat.course_id)
                            }
                          >
                            View Enrolled Students
                          </button>
                        </article>
                      ))}
                    </div>

                    {instructorCourseStats.length === 0 && (
                      <div className="empty-message">
                        No course statistics available.
                      </div>
                    )}
                  </section>

                  {/* ENROLLED STUDENTS */}
                  {selectedStudentsCourseId !== null && (
                    <section
                      className="enrolled-students-section"
                      id="enrolled-students-section"
                    >
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">
                            STUDENT MANAGEMENT
                          </span>

                          <h2>
                            {courseStudents?.course_title ||
                              "Enrolled Students"}
                          </h2>

                          <p>
                            {courseStudents?.total_students ?? 0}{" "}
                            students enrolled in this course.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setSelectedStudentsCourseId(null);
                            setCourseStudents(null);
                            setStudentsError("");
                          }}
                        >
                          Close
                        </button>
                      </div>

                      {studentsLoading ? (
                        <div className="empty-message">
                          Loading enrolled students...
                        </div>
                      ) : studentsError ? (
                        <div className="error-message">
                          {studentsError}
                        </div>
                      ) : courseStudents &&
                        courseStudents.students.length > 0 ? (
                        <div className="students-table-wrapper">
                          <table className="students-table">
                            <thead>
                              <tr>
                                <th>Student</th>
                                <th>Email</th>
                                <th>Lessons Completed</th>
                                <th>Progress</th>
                                <th>Enrollment Date</th>
                              </tr>
                            </thead>

                            <tbody>
                              {courseStudents.students.map(
                                (student) => (
                                  <tr key={student.student_id}>
                                    <td>
                                      {student.student_name}
                                    </td>

                                    <td>{student.email}</td>

                                    <td>
                                      {student.completed_lessons}{" "}
                                      / {student.total_lessons}
                                    </td>

                                    <td>
                                      <div className="student-progress">
                                        <strong>
                                          {student.progress_percentage}%
                                        </strong>

                                        <div className="progress-container">
                                          <div
                                            className="progress-bar"
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                Math.max(
                                                  0,
                                                  student.progress_percentage
                                                )
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </td>

                                    <td>
                                      {student.enrolled_at
                                        ? new Date(
                                            student.enrolled_at
                                          ).toLocaleDateString(
                                            "en-IN"
                                          )
                                        : "Not available"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-message">
                          No students have enrolled in this
                          course yet.
                        </div>
                      )}
                    </section>
                  )}

                  {/* CREATE OR EDIT COURSE */}
                  {editingCourseId === null ? (
                    <section className="course-form">
                      <h2>Create a New Course</h2>

                      <form onSubmit={createCourse}>
                        <label>
                          Course Title
                          <input
                            value={courseTitle}
                            onChange={(e) =>
                              setCourseTitle(e.target.value)
                            }
                            placeholder="Enter course title"
                            required
                          />
                        </label>

                        <label>
                          Description
                          <textarea
                            value={courseDescription}
                            onChange={(e) =>
                              setCourseDescription(e.target.value)
                            }
                            placeholder="Enter course description"
                            required
                          />
                        </label>

                        <label>
                          Category
                          <select
                            value={courseCategory}
                            onChange={(e) =>
                              setCourseCategory(e.target.value)
                            }
                          >
                            <option>Web Development</option>
                            <option>Programming</option>
                            <option>Database</option>
                            <option>Design</option>
                          </select>
                        </label>

                        <label>
                          Level
                          <select
                            value={courseLevel}
                            onChange={(e) =>
                              setCourseLevel(e.target.value)
                            }
                          >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                          </select>
                        </label>

                        <label>
                          Price
                          <input
                            type="number"
                            min="0"
                            value={coursePrice}
                            onChange={(e) =>
                              setCoursePrice(e.target.value)
                            }
                            required
                          />
                        </label>

                        <button
                          className="primary-btn"
                          type="submit"
                        >
                          Create Course
                        </button>
                      </form>
                    </section>
                  ) : (
                    <section className="course-form">
                      <h2>Edit Course</h2>

                      <form onSubmit={updateCourse}>
                        <label>
                          Course Title
                          <input
                            value={courseTitle}
                            onChange={(e) =>
                              setCourseTitle(e.target.value)
                            }
                            placeholder="Enter course title"
                            required
                          />
                        </label>

                        <label>
                          Description
                          <textarea
                            value={courseDescription}
                            onChange={(e) =>
                              setCourseDescription(e.target.value)
                            }
                            placeholder="Enter course description"
                            required
                          />
                        </label>

                        <label>
                          Category
                          <select
                            value={courseCategory}
                            onChange={(e) =>
                              setCourseCategory(e.target.value)
                            }
                          >
                            <option>Web Development</option>
                            <option>Programming</option>
                            <option>Database</option>
                            <option>Design</option>
                          </select>
                        </label>

                        <label>
                          Level
                          <select
                            value={courseLevel}
                            onChange={(e) =>
                              setCourseLevel(e.target.value)
                            }
                          >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                          </select>
                        </label>

                        <label>
                          Price
                          <input
                            type="number"
                            min="0"
                            value={coursePrice}
                            onChange={(e) =>
                              setCoursePrice(e.target.value)
                            }
                            required
                          />
                        </label>

                        <button
                          className="primary-btn"
                          type="submit"
                        >
                          Update Course
                        </button>

                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={cancelEditCourse}
                        >
                          Cancel
                        </button>
                      </form>
                    </section>
                  )}

                  {/* MY COURSES */}
                  <div className="section-heading">
                    <div>
                      <h2>My Courses</h2>
                      <p>
                        Manage your courses and lessons.
                      </p>
                    </div>
                  </div>

                  <div className="course-grid">
                    {myCourses.map((course) => (
                      <article
                        className="course-card"
                        key={course.id}
                      >
                        <div className="course-card-icon">
                          📘
                        </div>

                        <span className="course-category">
                          {course.category}
                        </span>

                        <h3>{course.title}</h3>
                        <p>{course.description}</p>

                        <div className="course-meta">
                          <span>{course.level}</span>
                          <strong>
                            {course.is_published
                              ? "Published"
                              : "Draft"}
                          </strong>
                        </div>

                        <button
                          className="primary-btn full-btn"
                          onClick={() => openCourse(course)}
                        >
                          Manage Lessons
                        </button>

                        <button
                          className="secondary-btn full-btn"
                          onClick={() =>
                            viewCourseStudents(course.id)
                          }
                        >
                          View Students
                        </button>

                        <button
                          className="secondary-btn full-btn"
                          onClick={() =>
                            startEditCourse(course)
                          }
                        >
                          Edit Course
                        </button>

                        <button
                          className="secondary-btn full-btn"
                          onClick={() =>
                            togglePublish(course)
                          }
                        >
                          {course.is_published
                            ? "Unpublish"
                            : "Publish"}
                        </button>

                        <button
                          className="danger-btn full-btn"
                          onClick={() =>
                            deleteCourse(course.id)
                          }
                        >
                          Delete Course
                        </button>
                      </article>
                    ))}
                  </div>

                  {myCourses.length === 0 && (
                    <div className="empty-message">
                      You have not created any courses yet.
                    </div>
                  )}
                </>
              )}

            {/* COURSE DETAILS */}
            {selectedCourse && (
              <section className="course-detail">
                <button
                  className="back-btn"
                  onClick={backToDashboard}
                >
                  ← Back to Dashboard
                </button>

                <div className="course-detail-header">
                  <span className="eyebrow">
                    COURSE CONTENT
                  </span>

                  <h1>{selectedCourse.title}</h1>
                  <p>{selectedCourse.description}</p>
                </div>

                {/* STUDENT PROGRESS AND CERTIFICATE */}
                {user.role === "student" && (
                  <>
                    <div className="progress-card">
                      <div className="progress-title">
                        <strong>
                          Your Learning Progress
                        </strong>

                        <strong>{progressPercent}%</strong>
                      </div>

                      <div className="progress-container">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, progressPercent)
                            )}%`,
                          }}
                        />
                      </div>

                      <p>
                        {progress?.completed_lessons ??
                          completedLessons.length}{" "}
                        of{" "}
                        {progress?.total_lessons ??
                          lessons.length}{" "}
                        lessons completed
                      </p>
                    </div>

                    {progressPercent >= 100 &&
                      (progress?.total_lessons ??
                        lessons.length) > 0 && (
                        <div className="certificate-action-card">
                          <div>
                            <h3>🎓 Course completed!</h3>
                            <p>
                              You have completed all lessons.
                              You can now get your certificate.
                            </p>
                          </div>

                          <button
                            className="primary-btn"
                            onClick={getCertificate}
                            disabled={certificateLoading}
                          >
                            {certificateLoading
                              ? "Checking..."
                              : "Get Certificate"}
                          </button>

                          {certificate && (
                            <div className="certificate-preview">
                              <h2>LEARNHUB</h2>

                              <p className="certificate-subtitle">
                                CERTIFICATE OF COMPLETION
                              </p>

                              <p>
                                This certificate is proudly
                                presented to
                              </p>

                              <h3>
                                {certificate.student_name}
                              </h3>

                              <p>
                                for successfully completing
                              </p>

                              <h4>
                                {certificate.course_name}
                              </h4>

                              <p>
                                {certificate.completed_lessons}{" "}
                                of {certificate.total_lessons}{" "}
                                lessons completed (
                                {certificate.progress_percentage}%)
                              </p>

                              <p>
                                Completion date:{" "}
                                {certificate.completion_date ||
                                  "Not available"}
                              </p>

                              <button
                                className="primary-btn"
                                onClick={downloadCertificate}
                              >
                                Download Certificate PDF
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                  </>
                )}

                {/* INSTRUCTOR ADD LESSON */}
                {user.role === "instructor" &&
                  !selectedLesson && (
                    <section className="course-form lesson-form">
                      <h2>Add New Lesson</h2>

                      <form onSubmit={addLesson}>
                        <label>
                          Lesson Title
                          <input
                            value={lessonTitle}
                            onChange={(e) =>
                              setLessonTitle(e.target.value)
                            }
                            placeholder="Enter lesson title"
                            required
                          />
                        </label>

                        <label>
                          Lesson Content
                          <textarea
                            value={lessonContent}
                            onChange={(e) =>
                              setLessonContent(e.target.value)
                            }
                            placeholder="Write the lesson content here. Use a new line for each heading and paragraph."
                            rows={8}
                            required
                          />
                        </label>

                        <button className="primary-btn">
                          Add Lesson
                        </button>
                      </form>
                    </section>
                  )}

                {/* LESSON VIEWER */}
                {selectedLesson ? (
                  <section className="lesson-viewer">
                    <button
                      className="back-btn"
                      onClick={backToLessons}
                    >
                      ← Back to Lessons
                    </button>

                    <div className="lesson-viewer-content">
                      <span className="eyebrow">
                        LESSON CONTENT
                      </span>

                      <h1>{selectedLesson.title}</h1>

                      <div className="lesson-content">
                        {renderLessonContent(
                          selectedLesson.content
                        )}
                      </div>

                      {user.role === "student" &&
                        (completedLessons.includes(
                          selectedLesson.id
                        ) ? (
                          <button
                            className="completed-btn"
                            disabled
                          >
                            ✓ Completed
                          </button>
                        ) : (
                          <button
                            className="primary-btn"
                            onClick={() =>
                              completeLesson(selectedLesson)
                            }
                          >
                            Mark as Completed
                          </button>
                        ))}
                    </div>
                  </section>
                ) : (
                  <section className="lessons-section">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          COURSE MATERIAL
                        </span>

                        <h2>
                          Lessons ({lessons.length})
                        </h2>
                      </div>
                    </div>

                    <div className="lesson-list">
                      {lessons.map((lesson, index) => (
                        <article
                          className="lesson-card"
                          key={lesson.id}
                        >
                          <div className="lesson-number">
                            {index + 1}
                          </div>

                          <div className="lesson-info">
                            <h3>{lesson.title}</h3>

                            <p>
                              {lesson.content.slice(0, 130)}
                              {lesson.content.length > 130
                                ? "..."
                                : ""}
                            </p>
                          </div>

                          <div className="lesson-actions">
                            <button
                              className="primary-btn"
                              onClick={() =>
                                setSelectedLesson(lesson)
                              }
                            >
                              Open Lesson
                            </button>

                            {user.role === "instructor" && (
                              <button
                                className="danger-btn"
                                onClick={() =>
                                  deleteLesson(lesson.id)
                                }
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>

                    {lessons.length === 0 && (
                      <div className="empty-message">
                        No lessons have been added to this
                        course yet.
                      </div>
                    )}
                  </section>
                )}
              </section>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <h3>LearnHub</h3>
        <p>Learn something new every day.</p>
        <p>© 2026 LearnHub. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
