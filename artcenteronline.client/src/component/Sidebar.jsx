import { Link } from "react-router-dom";
import { useAuth } from "../auth/authCore";
import { useEffect } from "react";


export default function Sidebar() {
    const { user, roles = [] } = useAuth();
    const isAdmin = roles.includes("Admin");
 


    useEffect(() => {
        document.body.classList.add("fixed", "sidebar-mini"); // bật fixed layout
        return () => document.body.classList.remove("fixed");
    }, []);

    return (
        <aside className="main-sidebar">
            <section className="sidebar">
                <div className="user-panel user-panel-compact">
                    <div className="info user-info-inline">
                        <span className="user-name">{user?.fullName || "Guest"}</span>
                        <span
                            className={`label ${roles?.[0] ? "label-success" : "label-default"} user-role-badge`}
                            title={roles?.[0] || "No Role"}
                        >
                            {roles?.[0] || "No Role"}
                        </span>
                    </div>
                </div>


                <ul className="sidebar-menu" data-widget="tree">
                    <li className="header">MAIN NAVIGATION</li>

                    {isAdmin && (
                        <li>
                            <Link to="/reports">
                                <i className="fa fa-line-chart" aria-hidden="true" /> <span>Báo cáo</span>
                            </Link>
                        </li>
                    )}

                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-users" /> <span>Quản lý lớp học</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/classes">
                                    <i className="fa fa-circle-o" /> Xem danh sách lớp học
                                </Link>
                            </li>
                            {isAdmin && (
                                <li>
                                    <Link to="/classes/add">
                                        <i className="fa fa-circle-o" /> Tạo lớp học mới
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </li>

                    {/* User (Admin only) */}
                    {isAdmin && (
                        <li className="treeview">
                            <a href="#">
                                <i className="fa fa-user" /> <span>Quản lý người dùng</span>
                                <i className="fa fa-angle-left pull-right" />
                            </a>
                            <ul className="treeview-menu">
                                <li>
                                    <Link to="/users">
                                        <i className="fa fa-circle-o" /> Xem danh sách người dùng
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/users/new">
                                        <i className="fa fa-circle-o" /> Thêm người dùng mới
                                    </Link>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Student */}
                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-graduation-cap" /> <span>Quản lý học viên</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/students">
                                    <i className="fa fa-circle-o" /> Xem danh sách học viên
                                </Link>
                            </li>
                            {isAdmin && (
                                <li>
                                    <Link to="/students/new">
                                        <i className="fa fa-circle-o" /> Thêm học viên mới
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </li>

                    {/* Teacher (Admin only) */}
                    {isAdmin && (
                        <li className="treeview">
                            <a href="#">
                                <i className="fa fa-briefcase" /> <span>Quản lý giáo viên</span>
                                <i className="fa fa-angle-left pull-right" />
                            </a>
                            <ul className="treeview-menu">
                                <li>
                                    <Link to="/teachers">
                                        <i className="fa fa-circle-o" /> Xem danh sách giáo viên
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/teachers/add">
                                        <i className="fa fa-circle-o" /> Thêm giáo viên mới
                                    </Link>
                                </li>
                            </ul>
                        </li>
                    )}

                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-graduation-cap" /> <span>Quản lý buổi học</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/sessions">
                                    <i className="fa fa-circle-o" /> Danh sách buổi học
                                </Link>
                            </li>
                            {isAdmin && (
                                <li>
                                    <Link to="/reports/export-attendance">
                                        <i className="fa fa-file-excel-o" /> <span>Xuất điểm danh</span>
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </li>
                </ul>
            </section>
        </aside>
    );
}
