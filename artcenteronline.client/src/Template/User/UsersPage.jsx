// src/Template/User/UsersPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUsers } from "./users"; // API
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function UsersPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    const location = useLocation();
    const navigate = useNavigate();

    // Toasts đồng bộ (success + error)
    const { showError, showSuccess, Toasts } = useToasts();

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getUsers();
                if (alive) setRows(Array.isArray(data) ? data : []);
            } catch (e) {
                if (alive) showError(extractErr(e) || "Không tải được danh sách người dùng.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [showError]);

    // Hiển thị notice (từ AddUser/EditUser) rồi xóa state để không lặp
    useEffect(() => {
        const notice = location.state?.notice;
        if (notice) {
            showSuccess(notice);
            // xóa state ngay để F5 không hiện lại
            navigate(".", { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Init DataTable
    useEffect(() => {
        if (loading) return;
        const $ = window.jQuery || window.$;
        if (!$?.fn?.DataTable || !tableRef.current) return;

        const el = tableRef.current;

        // Destroy nếu có sẵn
        if ($.fn.DataTable.isDataTable(el)) {
            $(el).DataTable().destroy(true);
        }

        const dt = $(el).DataTable({
            autoWidth: false,
            lengthChange: true,
            searching: true,
            ordering: true,
            paging: true,
            info: true,
            dom:
                "<'row'<'col-sm-6'l><'col-sm-6'f>>" +
                "tr" +
                "<'row'<'col-sm-5'i><'col-sm-7'p>>",
            language: {
                search: "Tìm kiếm:",
                lengthMenu: "Hiện _MENU_ dòng",
                info: "Hiển thị _START_-_END_ / _TOTAL_ dòng",
                paginate: { previous: "Trước", next: "Sau" },
                zeroRecords: "Không có dữ liệu",
            },
        });
        dt.columns.adjust();
        dtRef.current = dt;

        const onResize = () => dt.columns.adjust();
        window.addEventListener("resize", onResize);

        const obs = new MutationObserver(() => dt.columns.adjust());
        obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

        return () => {
            window.removeEventListener("resize", onResize);
            obs.disconnect();
            try { dt.destroy(true); } catch { /* noop */ }
            dtRef.current = null;
        };
    }, [loading, rows]);

    return (
        <>
            <section className="content-header">
                <h1>Bảng thông tin tài khoản</h1>
                <ol className="breadcrumb">
                    <li><a href="/"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><a href="/users">Quản lý người dùng</a></li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}

                        {!loading && (
                            <div className="table-responsive">
                                <table
                                    id="usersTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th style={{ width: 80 }}>ID</th>
                                            <th>Email</th>
                                            <th>Vai trò</th>
                                            <th>Trạng thái</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((x) => (
                                            <tr key={x.userId}>
                                                <td>{x.userId}</td>
                                                <td>{x.userEmail}</td>
                                                <td>{x.role}</td>
                                                <td>
                                                    <span className={`label ${x.status === 1 ? "label-success" : "label-default"}`}>
                                                        {x.status === 1 ? "Đang hoạt động" : "Ngừng hoạt động"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Link to={`/users/${x.userId}/edit`} className="btn btn-xs btn-primary">
                                                        <i className="fa fa-edit" /> Cập nhật
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
