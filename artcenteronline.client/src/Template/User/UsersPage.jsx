// src/Template/User/UsersPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getUsers } from "./users"; // hàm fetch API Users

export default function UsersPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const tableRef = useRef(null);
    const dtRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [notice, setNotice] = useState(location.state?.notice || "");

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getUsers();
                if (alive) setRows(Array.isArray(data) ? data : []);
            } catch (e) {
                if (alive) setErr(e?.message || "Fetch failed");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    // Clear route state.notice sau khi hiển thị 1 lần
    useEffect(() => {
        if (location.state?.notice) {
            // xóa state ngay lập tức (không gây re-render loop)
            setTimeout(() => navigate(".", { replace: true, state: {} }), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tự ẩn thông báo sau 4s
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    // Init DataTable
    useEffect(() => {
        if (loading || err) return;
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
            try { dt.destroy(true); } catch { /* empty */ }
            dtRef.current = null;
        };
    }, [loading, err, rows]);

    return (
        <>
            {/* Toast thành công (tự ẩn sau 4s) — giống Schedule */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 16,
                        zIndex: 9999,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                    }}
                >
                    <button
                        type="button"
                        className="close"
                        onClick={() => setNotice("")}
                        aria-label="Close"
                        style={{ marginLeft: 8 }}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button >
                    {notice}
                </div >
            )
            }
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
                        {err && <p className="text-red">Lỗi: {err}</p>}
                        {!loading && !err && (
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
        </>
    );
}

