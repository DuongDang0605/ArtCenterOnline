import { useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import ControlSidebar from "./ControlSidebar";
import { Outlet } from "react-router-dom";

export default function Layout() {
    // body classes cho AdminLTE
    useEffect(() => {
        document.body.classList.remove("layout-boxed");
        document.body.classList.add("hold-transition", "skin-blue", "sidebar-mini");
    }, []);

    return (
        <div className="wrapper">
            <Header />
            <Sidebar />
            <div className="content-wrapper">
                <Outlet />
            </div>
            <Footer />
            <ControlSidebar />
            <div className="control-sidebar-bg" />
        </div>
    );
}
