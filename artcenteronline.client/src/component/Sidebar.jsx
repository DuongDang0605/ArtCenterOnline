// src/component/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authCore";
import http from "../api/http";

export default function Sidebar() {
    const { user, roles = [] } = useAuth() || {};
    const [displayName, setDisplayName] = useState(user?.fullName || "Guest");

    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");
    const isStudent = roles.includes("Student");

    const primaryRole =
        (isAdmin && "Admin") ||
        (isTeacher && "Teacher") ||
        (isStudent && "Student") ||
        (roles[0] || "Guest");

    useEffect(() => {
        let alive = true;

        async function resolveName() {
            if (isAdmin) {
                if (alive) setDisplayName(user?.fullName || "Admin");
                return;
            }
            if (isTeacher) {
                const teacherId =
                    user?.teacherId ?? user?.TeacherId ?? user?.teacherID ?? null;
                if (teacherId) {
                    try {
                        const { data } = await http.get(`/Teachers/${teacherId}`);
                        const tname =
                            data?.teacherName ?? data?.TeacherName ?? user?.fullName;
                        if (alive) setDisplayName(tname || "Teacher");
                        return;
                    } catch {
                        if (alive) setDisplayName(user?.fullName || "Teacher");
                        return;
                    }
                }
                if (alive) setDisplayName(user?.fullName || "Teacher");
                return;
            }
            if (isStudent) {
                try {
                    const { data } = await http.get("/Students/me");
                    const sname = data?.studentName ?? data?.StudentName;
                    if (alive) setDisplayName(sname || user?.fullName || "Student");
                    return;
                } catch {
                    if (alive) setDisplayName(user?.fullName || "Student");
                    return;
                }
            }
            if (alive) setDisplayName(user?.fullName || "Guest");
        }

        resolveName();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.fullName, user?.teacherId, user?.TeacherId, isAdmin, isTeacher, isStudent]);

    return (
        <aside className="main-sidebar">
            <section className="sidebar">
                {/* User panel */}
                <div className="user-panel" style={{ height: 60, display: "flex", alignItems: "center" }}>
                    <div className="pull-left info" style={{ lineHeight: 1.2 }}>
                        <p style={{ marginBottom: 4 }}>{displayName}</p>
                        <a href="#">
                            <i className="fa fa-circle text-success" /> {primaryRole}
                        </a>
                    </div>
                </div>

                <ul className="sidebar-menu" data-widget="tree">
                    {(isAdmin || isTeacher) && (
                        <>
                            <li className="header">ĐIỀU HƯỚNG</li>

                            {/* Trang chủ / Dashboard */}
                            <li>
                                <Link to="/">
                                    <i className="fa fa-dashboard" /> <span>Trang chủ</span>
                                </Link>
                            </li>

                            {/* Quản lý lớp */}
                            <li className="treeview">
                                <a href="#">
                                    <i className="fa fa-university" /> <span>Quản lý lớp</span>
                                    <span className="pull-right-container">
                                        <i className="fa fa-angle-left pull-right" />
                                    </span>
                                </a>
                                <ul className="treeview-menu">
                                    <li>
                                        <Link to="/classes">
                                            <i className="fa fa-circle-o" /> Danh sách lớp
                                        </Link>
                                    </li>
                                    {isAdmin && (
                                        <li>
                                            <Link to="/classes/add">
                                                <i className="fa fa-circle-o" /> Thêm lớp
                                            </Link>
                                        </li>
                                    )}
                                    {isAdmin && (
                                        <li>
                                            <Link to="/class-students/import-excel">
                                                <i className="fa fa-circle-o" /> Thêm học viên vào lớp (Excel)
                                            </Link>
                                        </li>
                                    )}

                                </ul>
                            </li>

                            {/* Buổi học */}
                            <li className="treeview">
                                <a href="#">
                                    <i className="fa fa-clock-o" /> <span>Buổi học</span>
                                    <span className="pull-right-container">
                                        <i className="fa fa-angle-left pull-right" />
                                    </span>
                                </a>
                                <ul className="treeview-menu">
                                    <li>
                                        <Link to="/sessions">
                                            <i className="fa fa-circle-o" /> Danh sách buổi
                                        </Link>
                                    </li>
                                </ul>
                            </li>

                            {/* Quản lý học viên */}
                            <li className="treeview">
                                <a href="#">
                                    <i className="fa fa-graduation-cap" /> <span>Quản lý học viên</span>
                                    <span className="pull-right-container">
                                        <i className="fa fa-angle-left pull-right" />
                                    </span>
                                </a>
                                <ul className="treeview-menu">
                                    <li>
                                        <Link to="/students">
                                            <i className="fa fa-circle-o" /> Danh sách học viên
                                        </Link>
                                    </li>
                                    {/* Lịch theo học viên: chỉ Admin & Teacher */}
                                    <li>
                                        <Link to="/calendar/student">
                                            <i className="fa fa-circle-o" /> Lịch theo học viên
                                        </Link>
                                    </li>
                                    {isAdmin && (
                                        <li>
                                            <Link to="/students/new">
                                                <i className="fa fa-circle-o" /> Thêm học viên mới
                                            </Link>
                                        </li>
                                    )}
                                    {isAdmin && (
                                        <li>
                                            <Link to="/students/import-excel">
                                                <i className="fa fa-circle-o" /> Thêm học viên (Excel)
                                            </Link>
                                        </li>
                                    )}
                                </ul>
                            </li>

                            {/* Nhóm Admin-only */}
                            {isAdmin && (
                                <>
                                    <li className="header">QUẢN TRỊ </li>

                                    <li className="treeview">
                                        <a href="#">
                                            <i className="fa fa-user" /> <span>Giáo viên</span>
                                            <span className="pull-right-container">
                                                <i className="fa fa-angle-left pull-right" />
                                            </span>
                                        </a>
                                        <ul className="treeview-menu">
                                            <li>
                                                <Link to="/teachers">
                                                    <i className="fa fa-circle-o" /> Danh sách giáo viên
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/teachers/add">
                                                    <i className="fa fa-circle-o" /> Thêm giáo viên
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    <li className="treeview">
                                        <a href="#">
                                            <i className="fa fa-users" /> <span>Người dùng</span>
                                            <span className="pull-right-container">
                                                <i className="fa fa-angle-left pull-right" />
                                            </span>
                                        </a>
                                        <ul className="treeview-menu">
                                            <li>
                                                <Link to="/users">
                                                    <i className="fa fa-circle-o" /> Danh sách người dùng
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/users/new">
                                                    <i className="fa fa-circle-o" /> Thêm người dùng
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    <li className="treeview">
                                        <a href="#">
                                            <i className="fa fa-bar-chart" /> <span>Báo cáo</span>
                                            <span className="pull-right-container">
                                                <i className="fa fa-angle-left pull-right" />
                                            </span>
                                        </a>
                                        <ul className="treeview-menu">
                                            <li>
                                                <Link to="/reports">
                                                    <i className="fa fa-circle-o" /> Dashboard báo cáo
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/reports/export-attendance">
                                                    <i className="fa fa-file-excel-o" /> <span>Xuất điểm danh</span>
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>
                                </>
                            )}
                        </>
                    )}

                    {/* NHÓM HỌC VIÊN (Student self) — chỉ Student */}
                    {isStudent && !isAdmin && !isTeacher && (
                        <>
                            <li className="header">HỌC VIÊN</li>
                            <li>
                                <Link to="/me/schedule">
                                    <i className="fa fa-calendar" /> <span>Thời khóa biểu của tôi</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/me/profile">
                                    <i className="fa fa-id-card" /> <span>Thông tin của tôi</span>
                                </Link>
                            </li>
                        </>
                    )}
                </ul>
            </section>
        </aside>
    );
}
