import { Link } from "react-router-dom";
import { useAuth } from "../auth/authCore";

export default function Header() {
    const { user, roles, logout } = useAuth();

    const toggleSidebar = (e) => {
        e.preventDefault();
        if (window.innerWidth > 767) {
            document.body.classList.toggle("sidebar-collapse");
        } else {
            document.body.classList.toggle("sidebar-open");
        }
        setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
    };

    const toggleControl = (e) => {
        e.preventDefault();
        const el = document.querySelector(".control-sidebar");
        if (el) el.classList.toggle("control-sidebar-open");
    };

    return (
        <header className="main-header">
            <Link to="/" className="logo">
                <span className="logo-mini"><b>A</b>LT</span>
                <span className="logo-lg"><b>ArtCenter</b>Online</span>
            </Link>

            <nav className="navbar navbar-static-top">
                <a href="#" className="sidebar-toggle" role="button" onClick={toggleSidebar}>
                    <span className="sr-only">Toggle navigation</span>
                </a>

                <div className="navbar-custom-menu">
                    <ul className="nav navbar-nav">
                        <li className="dropdown user user-menu">
                            <a href="#" className="dropdown-toggle" data-toggle="dropdown">
                                <img src="/AdminLTE/dist/img/A1.jpg" className="user-image" alt="User" />
                                <span className="hidden-xs">{user?.fullName || "Guest"}</span>
                            </a>
                            <ul className="dropdown-menu">
                                <li className="user-header">
                                    <img src="/AdminLTE/dist/img/A1.jpg" className="img-circle" alt="User" />
                                    <p>
                                        {user?.fullName || "Guest"} - {roles?.join(", ") || "No Role"}
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

                        <li>
                            <a href="#" onClick={toggleControl}>
                                <i className="fa fa-gears" />
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>
        </header>
    );
}
