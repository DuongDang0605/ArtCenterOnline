import { Link } from "react-router-dom";
import { useAuth } from "../auth/authCore";
import { useEffect, useState } from "react";
import http from "../api/http";

export default function Header() {
    const { user, roles, logout } = useAuth();
    const [displayName, setDisplayName] = useState(user?.fullName || "Guest");

    const isAdmin = roles?.includes("Admin");
    const isTeacher = roles?.includes("Teacher");
    const isStudent = roles?.includes("Student");

    useEffect(() => {
        let alive = true;

        async function resolveName() {
            // Admin: lấy từ user
            if (isAdmin) {
                if (alive) setDisplayName(user?.fullName || "Admin");
                return;
            }

            // Teacher: gọi theo teacherId
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

            // Student: /Students/me
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

            // Fallback
            if (alive) setDisplayName(user?.fullName || "Guest");
        }

        resolveName();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.fullName, user?.teacherId, user?.TeacherId, isAdmin, isTeacher, isStudent]);

    const toggleSidebar = (e) => {
        e.preventDefault();
        if (window.innerWidth > 767) {
            document.body.classList.toggle("sidebar-collapse");
        } else {
            document.body.classList.toggle("sidebar-open");
        }
        setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
    };

    // eslint-disable-next-line no-unused-vars
    const toggleControl = (e) => {
        e.preventDefault();
        const el = document.querySelector(".control-sidebar");
        if (el) el.classList.toggle("control-sidebar-open");
    };

    useEffect(() => {
        document.body.classList.add("fixed", "sidebar-mini");
        return () => document.body.classList.remove("fixed");
    }, []);

    return (
        <header className="main-header">
            <Link to="/" className="logo">
                <span className="logo-mini">
                    <b>A</b>LT
                </span>
                <span className="logo-lg">
                    <b>ArtCenter</b>Online
                </span>
            </Link>

            <nav className="navbar navbar-static-top">
                <a href="#" className="sidebar-toggle" role="button" onClick={toggleSidebar}>
                    <span className="sr-only">Toggle navigation</span>
                </a>

                <div className="navbar-custom-menu">
                    <ul className="nav navbar-nav">
                        <li className="dropdown user user-menu">
                            <a href="#" className="dropdown-toggle" data-toggle="dropdown">
                                <span className="hidden-xs">{displayName}</span>
                            </a>
                            <ul className="dropdown-menu">
                                <li className="user-header">
                                    <p>
                                        {displayName} - {roles?.join(", ") || "No Role"}
                                    </p>
                                </li>
                                <li className="user-footer">
                                    <div className="pull-left">
                                        <Link to="/profile" className="btn btn-default btn-flat">
                                            Profile
                                        </Link>
                                    </div>
                                    <div className="pull-right">
                                        <button onClick={logout} className="btn btn-default btn-flat">
                                            Sign out
                                        </button>
                                    </div>
                                </li>
                            </ul>
                        </li>

                    </ul>
                </div>
            </nav>
        </header>
    );
}
