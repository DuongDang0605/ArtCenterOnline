// src/Template/Class/ClassesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authCore";
import { getClasses } from "./classes";

// (giữ nguyên callSyncMonth như cũ)
async function callSyncMonth(classId, onOk) {
    try {
        const mod = await import("../Session/sessions");
        if (typeof mod.syncMonth === "function") {
            await mod.syncMonth(classId);
            if (typeof onOk === "function") onOk("Đã lên lịch tháng này cho lớp #" + classId);
            else alert("Đã lên lịch tháng này cho lớp #" + classId);
        } else {
            alert("Chức năng syncMonth chưa sẵn sàng.");
        }
    } catch {
        alert("Không tìm thấy module syncMonth.");
    }
}

export default function ClassesPage() {
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const location = useLocation();
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    // ===== Success toast =====
    const AUTO_SUCCESS = 5000; // ms
    const [toastOk, setToastOk] = useState("");
    const [okRemain, setOkRemain] = useState(0);

    function showOk(msg) {
        const text = (msg || "").trim();
        setToastOk(text);
        if (text) setOkRemain(AUTO_SUCCESS);
    }
    useEffect(() => {
        if (!toastOk) return;
        const start = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_SUCCESS - (Date.now() - start));
            setOkRemain(left);
            if (left === 0) setToastOk("");
        }, 100);
        return () => clearInterval(iv);
    }, [toastOk]);

    // Guard: chưa đăng nhập -> login
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
        }
    }, [isLoggedIn, navigate]);

    // Nhận flash
    useEffect(() => {
        const f = location?.state?.flash;
        if (f) {
            showOk(String(f));
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Load data
    useEffect(() => {
        if (!isLoggedIn) return;
        let alive = true;
        (async () => {
            try {
                const data = await getClasses();
                if (!alive) return;
                setRows(Array.isArray(data) ? data : []);
            } catch (e) {
                const s = e?.response?.status;
                if (s === 401) {
                    navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                    return;
                }
                if (alive) setErr(e?.response?.data ?? e?.message ?? "Load lớp thất bại");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [isLoggedIn, navigate]);
    // DataTable
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    useEffect(() => {
        if (loading || err) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        // destroy nếu đã init
        if ($.fn.dataTable.isDataTable(el)) {
            try { $(el).DataTable().destroy(); } catch { /* ignore */ }
        }

        const timer = setTimeout(() => {
            const dt = $(el).DataTable({
                autoWidth: false,
                lengthChange: true,
                searching: true,
                ordering: true,
                paging: true,
                info: true,
                pageLength: 10,
                order: [[0, "asc"]],
                dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
                language: {
                    decimal: ",",
                    thousands: ".",
                    emptyTable: "Không có dữ liệu",
                    info: "Hiển thị _START_–_END_ trên tổng _TOTAL_ dòng",
                    infoEmpty: "Hiển thị 0–0 trên tổng 0 dòng",
                    infoFiltered: "(lọc từ _MAX_ dòng)",
                    lengthMenu: "Hiện _MENU_ dòng",
                    loadingRecords: "Đang tải...",
                    processing: "Đang xử lý...",
                    search: "Tìm kiếm:",
                    zeroRecords: "Không tìm thấy kết quả phù hợp",
                    paginate: { first: "Đầu", last: "Cuối", next: "Sau", previous: "Trước" },
                    aria: { sortAscending: ": sắp xếp tăng dần", sortDescending: ": sắp xếp giảm dần" },
                },
                columnDefs: [
                    { targets: 0, width: 10 },   // ID
                    { targets: 1, width: 120 },  // Tên lớp
                    { targets: 2, width: 100 },  // Chi nhánh
                    { targets: 3, width: 90 },   // Trạng thái
                    { targets: 4, width: 160 },  // Lịch học / Sync
                    { targets: 5, width: 180 },  // Hành động
                ],
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
            };
        }, 0);

        return () => {
            clearTimeout(timer);
            try { $(el).DataTable().destroy(); } catch { /* ignore */ }
            dtRef.current = null;
        };
    }, [loading, err, rows]);

    // Chuẩn hoá 1 row — hỗ trợ cả PascalCase & camelCase
    const norm = (x) => {
        const id = x.ClassID ?? x.classID ?? x.classId ?? x.id;
        const name = x.ClassName ?? x.className ?? "";
        const branch = x.Branch ?? x.branch ?? "";
        const status = x.Status ?? x.status ?? 1;
        return { id, name, branch, status };
    };

    return (
        <>
            <section className="content-header">
                <h1>Danh sách lớp học</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li className="active">Lớp học</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Bảng lớp học</h3>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {err && <p className="text-red">Lỗi: {String(err)}</p>}

                        {!loading && !err && (
                            <div className="table-responsive">
                                <table
                                    id="ClassesTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Tên lớp</th>
                                            <th>Chi nhánh</th>
                                            <th>Trạng thái</th>
                                            <th>Lịch học</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((x, i) => {
                                            const c = norm(x);
                                            return (
                                                <tr key={c.id ?? i}>
                                                    <td>{c.id}</td>
                                                    <td>{c.name}</td>
                                                    <td>{c.branch}</td>
                                                    <td>
                                                        {c.status === 1 ? (
                                                            <span className="label label-success">Đang mở</span>
                                                        ) : c.status === 2 ? (
                                                            <span className="label label-default">Tạm dừng</span>
                                                        ) : c.status === 3 ? (
                                                            <span className="label label-danger">Huỷ</span>
                                                        ) : (
                                                            <span className="label label-default">—</span>
                                                        )}
                                                    </td>

                                                    {/* Lịch học / Sync tháng */}
                                                    <td>
                                                        <div className="btn-group btn-group-xs" role="group">
                                                            
                                                            {isAdmin ? (
                                                                <div>
                                                                    <Link to={`/classes/${c.id}/schedules`} className="btn btn-warning btn-xs">
                                                                        <i className="fa fa-calendar" /> Xét lịch
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        className={`btn btn-xs ${c.status === 1 ? "btn-success" : "btn-default disabled"}`}
                                                                        onClick={() => c.status === 1 && callSyncMonth(c.id, showOk)}
                                                                        disabled={c.status !== 1}
                                                                        title={c.status === 1 ? "Lên lịch tháng cho lớp này" : "Lớp đã tắt — không thể lên lịch"}
                                                                        style={c.status !== 1 ? { cursor: "not-allowed", opacity: .6 } : undefined}
                                                                    >
                                                                        <i className="fa fa-refresh" /> Lên lịch tháng
                                                                    </button>

                                                                </div>
                                                            ) : (
                                                                 <div>
                                                                        <Link to={`/classes/${c.id}/schedules`} className="btn btn-default btn-xs disabled">
                                                                            <i className="fa fa-calendar" /> Xét lịch
                                                                        </Link>       
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-default btn-xs disabled"
                                                                    disabled
                                                                    title="Chỉ Admin được đồng bộ"
                                                                    style={{ cursor: "not-allowed", opacity: .6 }}
                                                                >
                                                                    <i className="fa fa-refresh" /> Lên lịch tháng
                                                                        </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Hành động */}
                                                    <td>
                                                        <div className="btn-group btn-group-xs" role="group">     
                                                            {isAdmin ? (
                                                                <>
                                                                    <Link to={`/classes/${c.id}/edit`} className="btn btn-primary btn-xs">
                                                                        <i className="fa fa-edit" /> Cập nhật
                                                                    </Link>
                                                                    <Link to={`/classes/${c.id}/students`} className="btn btn-info btn-xs">
                                                                        <i className="fa fa-users" /> Xem học viên
                                                                    </Link>
                                                                    <Link to={`/classes/${c.id}/available-students`} className="btn btn-success btn-xs">
                                                                        <i className="fa fa-user-plus" /> Thêm học viên
                                                                    </Link>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button className="btn btn-default btn-xs disabled" disabled title="Chỉ Admin được cập nhật" style={{ cursor: "not-allowed", opacity: .6 }}>
                                                                        <i className="fa fa-edit" /> Cập nhật
                                                                    </button>
                                                                    <Link to={`/classes/${c.id}/students`} className="btn btn-info btn-xs">
                                                                        <i className="fa fa-users" /> Xem học viên
                                                                    </Link>
                                                                    <button className="btn btn-default btn-xs disabled" disabled title="Chỉ Admin được thêm học viên" style={{ cursor: "not-allowed", opacity: .6 }}>
                                                                        <i className="fa fa-user-plus" /> Thêm học viên
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== Success toast (đếm ngược + progress, giống StudentInClass) ===== */}
            {toastOk && (
                <div
                    className="alert alert-success"
                    style={{
                        position: "fixed",
                        top: 120, // error toast (nếu có) thường ở 70; success ở dưới một chút cho khỏi đè nhau
                        right: 16,
                        zIndex: 9998,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)"
                    }}
                >
                    <button
                        type="button"
                        className="close"
                        onClick={() => setToastOk("")}
                        aria-label="Close"
                        style={{ marginLeft: 8 }}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>

                    <div style={{ whiteSpace: "pre-wrap" }}>{toastOk}</div>

                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(okRemain / 1000).toFixed(1)}s
                    </div>

                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(okRemain / AUTO_SUCCESS) * 100}%`,
                                background: "#3c763d",
                                transition: "width 100ms linear"
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
