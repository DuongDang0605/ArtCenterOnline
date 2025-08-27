import { Link } from "react-router-dom";
import { useAuth } from "../auth/authCore";

export default function Sidebar() {
    const { user, roles = [] } = useAuth();
    const isAdmin = roles.includes("Admin");

    return (
        <aside className="main-sidebar">
            <section className="sidebar">
                <div className="user-panel">
                    <div className="pull-left image">
                        <img
                            src="/AdminLTE/dist/img/user2-160x160.jpg"
                            className="img-circle"
                            alt="User"
                        />
                    </div>
                    <div className="pull-left info">
                        <p>{user?.fullName || "Guest"}</p>
                        <a href="#">
                            <i className="fa fa-circle text-success" /> {roles?.[0] || "No Role"}
                        </a>
                    </div>
                </div>

                <ul className="sidebar-menu" data-widget="tree">
                    <li className="header">MAIN NAVIGATION</li>

                    {/* Class */}
                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-users" /> <span>Class</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/classes">
                                    <i className="fa fa-circle-o" /> View All Classes
                                </Link>
                            </li>
                            {isAdmin && (
                                <li>
                                    <Link to="/classes/add">
                                        <i className="fa fa-circle-o" /> Add Class
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </li>

                    {/* User (Admin only) */}
                    {isAdmin && (
                        <li className="treeview">
                            <a href="#">
                                <i className="fa fa-user" /> <span>User</span>
                                <i className="fa fa-angle-left pull-right" />
                            </a>
                            <ul className="treeview-menu">
                                <li>
                                    <Link to="/users">
                                        <i className="fa fa-circle-o" /> View All Users
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/users/new">
                                        <i className="fa fa-circle-o" /> Add User
                                    </Link>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Student */}
                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-graduation-cap" /> <span>Student</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/students">
                                    <i className="fa fa-circle-o" /> View All Students
                                </Link>
                            </li>
                            {isAdmin && (
                                <li>
                                    <Link to="/students/new">
                                        <i className="fa fa-circle-o" /> Add Student
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </li>

                    {/* Teacher (Admin only) */}
                    {isAdmin && (
                        <li className="treeview">
                            <a href="#">
                                <i className="fa fa-briefcase" /> <span>Teacher</span>
                                <i className="fa fa-angle-left pull-right" />
                            </a>
                            <ul className="treeview-menu">
                                <li>
                                    <Link to="/teachers">
                                        <i className="fa fa-circle-o" /> View All Teachers
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/teachers/add">
                                        <i className="fa fa-circle-o" /> Add Teacher
                                    </Link>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Sessions */}
                    <li className="treeview">
                        <a href="#">
                            <i className="fa fa-calendar" /> <span>Sessions</span>
                            <i className="fa fa-angle-left pull-right" />
                        </a>
                        <ul className="treeview-menu">
                            <li>
                                <Link to="/sessions">
                                    <i className="fa fa-circle-o" /> View All Sessions
                                </Link>
                            </li>
                        </ul>
                    </li>
                </ul>
            </section>
        </aside>
    );
}
