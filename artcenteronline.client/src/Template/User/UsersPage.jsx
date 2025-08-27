// src/Template/User/UsersPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link} from "react-router-dom";

import { getUsers } from "./users"; // hàm fetch API Users

export default function UsersPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const tableRef = useRef(null);
    const dtRef = useRef(null);

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
            <section className="content-header">
                <h1>Users Tables</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Home</a></li>
                    <li><a href="#">Users</a></li>
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
                                            
                                            <th>Role</th>
                                            <th>Status</th>
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
                                                        {x.status === 1 ? "Active" : "Inactive"}
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

