// src/Template/Class/ClassesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authCore";
import { getClasses } from "./classes";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

// Gọi syncMonth, ném lỗi để bên ngoài xử lý toast
async function callSyncMonth(classId) {
    const mod = await import("../Session/sessions");
    if (typeof mod.syncMonth !== "function") {
        throw new Error("Chức năng syncMonth chưa sẵn sàng.");
    }
    await mod.syncMonth(classId);
}

export default function ClassesPage() {
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const location = useLocation();
    const navigate = useNavigate();

    const { showError, showSuccess, Toasts } = useToasts();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // ===== Nhận success từ trang khác điều hướng tới (flash/notice) =====
    useEffect(() => {
        const n = location?.state?.notice || location?.state?.flash;
        if (n) {
            showSuccess(String(n));
            // xoá state để F5 không hiện lại
            setTimeout(() => navigate(location.pathname, { replace: true, state: {} }), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Guard: chưa đăng nhập -> login
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
        }
    }, [isLoggedIn, navigate]);

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
                showError(extractErr(e) || "Load lớp thất bại");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    // DataTable
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    useEffect(() => {
        if (loading) return;
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
    }, [loading, rows]);

    // Chuẩn hoá 1 row — hỗ trợ cả PascalCase & camelCase
    const norm = (x) => {
        const id = x.ClassID ?? x.classID ?? x.classId ?? x.id;
        const name = x.ClassName ?? x.className ?? "";
        const branch = x.Branch ?? x.branch ?? "";
        const status = x.Status ?? x.status ?? 1;
        return { id, name, branch, status };
    };

    // ===== Xác nhận trước khi "Lên lịch tháng" =====
    const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
    const [targetClassId, setTargetClassId] = useState(null);
    const [syncBusy, setSyncBusy] = useState(false);

    function askSync(id) {
        setTargetClassId(id);
        setSyncConfirmOpen(true);
    }

    async function doSync() {
        if (!targetClassId) return;
        setSyncBusy(true);
        try {
            await callSyncMonth(targetClassId);
            showSuccess(`Đã lên lịch tháng cho lớp #${targetClassId}`);
        } catch (e) {
            showError(extractErr(e) || "Lên lịch tháng thất bại.");
        } finally {
            setSyncBusy(false);
            setSyncConfirmOpen(false);
            setTargetClassId(null);
        }
    }

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

                        {!loading && (
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
                                                                        onClick={() => c.status === 1 && askSync(c.id)}
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

            {/* Modal xác nhận sync tháng — căn giữa, tiêu đề in đậm */}
            <ConfirmDialog
                open={syncConfirmOpen}
                type="primary"
                title="Xác nhận lên lịch tháng"
                message={`Bạn có chắc chắn muốn lên lịch tháng này cho lớp #${targetClassId}?`}
                confirmText="Lên lịch"
                cancelText="Để sau"
                onCancel={() => { if (!syncBusy) { setSyncConfirmOpen(false); setTargetClassId(null); } }}
                onConfirm={doSync}
                busy={syncBusy}
            />

            {/* Toasts chung (success + error) */}
            <Toasts />
        </>
    );
}
