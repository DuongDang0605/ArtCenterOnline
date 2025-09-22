// src/App.jsx
import { Routes, Route } from "react-router-dom";
import Layout from "./component/Layout";
import "font-awesome/css/font-awesome.min.css";


// Auth infra (ĐÃ SỬA ĐÚNG)
import AuthProvider from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import RequireRole from "./auth/RequireRole";

// Auth UI
import LoginPage from "./Template/Auth/LoginPage";
import ForgotPasswordPage from "./Template/Auth/ForgotPasswordPage.jsx";

// Pages
import ClassesPage from "./Template/Class/ClassesPage.jsx";
import UsersPage from "./Template/User/UsersPage.jsx";
import StudentsPage from "./Template/Student/StudentsPage.jsx";
import TeachersPage from "./Template/Teacher/TeachersPage.jsx";
import EditStudentPage from "./Template/Student/EditStudentPage.jsx";
import EditTeacherPage from "./Template/Teacher/EditTeacherPage.jsx";
import EditUserPage from "./Template/User/EditUserPage.jsx";
import AddUserPage from "./Template/User/AddUserPage.jsx";
import AddStudentPage from "./Template/Student/AddStudentPage.jsx";
import EditClassPage from "./Template/Class/EditClassPage.jsx";
import AddClassPage from "./Template/Class/AddClassPage.jsx";
import AddTeacherPage from "./Template/Teacher/AddTeacherPage.jsx";
import ClassAvailableStudentsPage from "./Template/Class/ClassAvailableStudentsPage";
import ClassStudentsInClassPage from "./Template/Class/ClassStudentsInClassPage";
import ClassSchedulesPage from "./Template/ClassSchedule/ClassSchedulesPage.jsx";
import AddEditSchedulePage from "./Template/ClassSchedule/AddEditSchedulePage.jsx";
import SessionsPage from "./Template/Session/SessionsPage.jsx";
import EditSessionPage from "./Template/Session/EditSessionPage.jsx";
import SessionAttendancePage from "./Template/Session/SessionAttendancePage.jsx";
import ImportStudentsExcelPage from "./Template/Student/ImportStudentsExcelPage.jsx";
import ImportClassStudentsExcelPage from "./Template/Class/ImportClassStudentsExcelPage";



import ProfilePage from "./Template/Profile/ProfilePage";
import ReportsDashboardPage from "./Template/Reports/ReportsDashboardPage.jsx";

// Nếu đã tách monthly calendar
import MonthlyCalendar from "./component/MonthlyCalendar";
import AttendanceExportPage from "./Template/Reports/AttendanceExportPage.jsx";
import StudentCalendarPage from "./Template/Student/StudentCalendarPage.jsx";
import StudentSelfCalendarPage from "./Template/Student/StudentSelfCalendarPage.jsx";
import StudentProfilePage from "./Template/Student/StudentProfilePage.jsx";

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* Protected app */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Layout />}>
                        {/* Dashboard (index) */}
                        <Route
                            index
                            element={
                                <>
                                    <section className="content-header">
                                        <h1>Dashboard</h1>
                                    </section>
                                    <section className="content">
                                        <MonthlyCalendar />
                                    </section>
                                </>
                            }
                        />
                        <Route
                            path="reports"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <ReportsDashboardPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="reports/export-attendance"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <AttendanceExportPage />
                                </RequireRole>
                            }
                        />

                        {/* Students */}
                        <Route path="students" element={<StudentsPage />} />
                        <Route
                            path="students/new"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <AddStudentPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="students/:id/edit"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <EditStudentPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="me/schedule"
                            element={
                                <RequireRole roles={["Student"]}>
                                    <StudentSelfCalendarPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="me/profile"
                            element={
                                <RequireRole roles={["Student"]}>
                                    <StudentProfilePage />
                                </RequireRole>
                            }
                        />
                        {/* Import Students (Excel) — Admin only */}
                        <Route
                            path="students/import-excel"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <ImportStudentsExcelPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="/class-students/import-excel"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <ImportClassStudentsExcelPage />
                                </RequireRole>
                            }
                        />


                        {/* Classes */}
                        <Route path="classes" element={<ClassesPage />} />
                        <Route
                            path="classes/add"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <AddClassPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="classes/:id/edit"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <EditClassPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="classes/:classId/available-students"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <ClassAvailableStudentsPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="classes/:classId/students"
                            element={
                                <RequireRole >
                                    <ClassStudentsInClassPage />
                                </RequireRole>
                            }
                        />
                        <Route path="classes/:classId/schedules" element={<ClassSchedulesPage />} />
                        <Route
                            path="classes/:classId/schedules/new"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <AddEditSchedulePage mode="create" />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="classes/:classId/schedules/:id/edit"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <AddEditSchedulePage mode="edit" />
                                </RequireRole>
                            }
                        />

                        {/* Users (Admin only) – giữ nguyên như bạn đã có */}
                        <Route path="users" element={<RequireRole roles={["Admin"]}><UsersPage /></RequireRole>} />
                        <Route path="users/new" element={<RequireRole roles={["Admin"]}><AddUserPage /></RequireRole>} />
                        <Route path="users/:id/edit" element={<RequireRole roles={["Admin"]}><EditUserPage /></RequireRole>} />

                        {/* Teachers (Admin only) – thêm chặn danh sách */}
                        <Route path="teachers" element={<TeachersPage />} />
                        <Route path="teachers/add" element={<RequireRole roles={["Admin"]}><AddTeacherPage /></RequireRole>} />
                        <Route path="teachers/:id/edit" element={<RequireRole roles={["Admin"]}><EditTeacherPage /></RequireRole>} />

                        {/* Sessions */}
                        <Route path="sessions" element={<SessionsPage />} />
                        <Route
                            path="sessions/:id/edit"
                            element={
                                <RequireRole roles={["Admin"]}>
                                    <EditSessionPage />
                                </RequireRole>
                            }
                        />
                        <Route
                            path="sessions/:id/attendance"
                            element={
                                <RequireRole >
                                    <SessionAttendancePage />
                                </RequireRole>
                            }
                        />
                        <Route path="/profile" element={<ProfilePage />} />

                        {/* Student calendar */}
                        <Route
                            path="calendar/student"
                            element={
                                <RequireRole roles={["Admin", "Teacher"]}>
                                    <StudentCalendarPage />
                                </RequireRole>
                            }
                        />



                        {/* (Tuỳ chọn) 404 trong layout */}
                        <Route path="*" element={<div className="p-3">Không tìm thấy trang</div>} />
                    </Route>
                </Route>

                {/* (Tuỳ chọn) 404 ngoài protected */}
                <Route path="*" element={<div className="p-3">Không tìm thấy trang</div>} />
            </Routes>
        </AuthProvider>
    );
}
