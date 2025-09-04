// src/Template/Class/ClassesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authCore";
import { getClasses } from "./classes";

// (tuỳ chọn) sync lịch tháng — nạp động để tránh vỡ import nếu module chưa có
async function callSyncMonth(classId) {
    try {
        const mod = await import("../Session/sessions");
        if (typeof mod.syncMonth === "function") {
            await mod.syncMonth(classId);
            alert("Đã lên lịch tháng này cho lớp #" + classId);
        } else {
            alert("Chức năng syncMonth chưa sẵn sàng.");
        }
    } catch {
        alert("Không tìm thấy module syncMonth.");
    }
}

export default function ClassesPage() {
    const { roles: ctxRoles = [] } = useAuth();
    const isAdmin = ctxRoles.includes("Admin");

    const location = useLocation();
    const navigate = useNavigate();

    const [flash, setFlash] = useState(""); // ⬅️ banner success
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Nhận flash từ điều hướng (EditClassPage)
    useEffect(() => {
        const f = location?.state?.flash;
        if (f) {
            setFlash(String(f));
            // xoá state để F5 không hiện lại
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getClasses();
                if (!alive) return;
                setRows(Array.isArray(data) ? data : []);
            } catch (e) {
                if (alive) setErr(e?.response?.data ?? e?.message ?? "Load lớp thất bại");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    // Init / re-init DataTable (phong cách AdminLTE, không destroy(true))
    useEffect(() => {
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !window?.jQuery) return;
        if (loading || err) return;

        const $table = $(el);

        // Huỷ nhẹ nếu đã init (giữ DOM node)
        if ($.fn.dataTable.isDataTable(el)) {
            $table.DataTable().destroy();
        }

        const dt = $table.DataTable({
            autoWidth: false,
            lengthChange: true,
            searching: true,
            ordering: true,
            paging: true,
            info: true,
            pageLength: 10,
            order: [[0, "asc"]],
            dom:
                "<'row'<'col-sm-6'l><'col-sm-6'f>>" +
                "tr" +
                "<'row'<'col-sm-5'i><'col-sm-7'p>>",
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
                { targets: 0, width: 80 },   // ID
                { targets: 2, width: 140 },  // Chi nhánh
                { targets: 3, width: 180 },  // GV chính
                { targets: 4, width: 120 },  // Trạng thái
                { targets: 5, width: 220 },  // Lịch học
                { targets: 6, width: 280 },  // Hành động
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
            try { dt.destroy(); } catch { /* empty */ }
            dtRef.current = null;
        };
    }, [loading, err, rows]);

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
                        {/* Banner success khi quay lại từ EditClass */}
                        {flash && (
                            <div className="alert alert-success alert-dismissible" role="alert" style={{ fontSize: 16, fontWeight: "bold" }}>
                                <button type="button" className="close" aria-label="Close" onClick={() => setFlash("")} style={{ fontSize: 20 }}>
                                    <span aria-hidden="true">&times;</span>
                                </button>
                                <i className="fa fa-check-circle" style={{ marginRight: 6 }} />
                                {flash}
                            </div>
                        )}

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
                                            <th>Giáo viên chính</th>
                                            <th>Trạng thái</th>
                                            <th>Lịch học</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((x) => (
                                            <tr key={x.classID}>
                                                <td>{x.classID}</td>
                                                <td>{x.className}</td>
                                                <td>{x.branch ?? "-"}</td>
                                                <td>{x.mainTeacherName ?? "-"}</td>
                                                <td>
                                                    {x.status === 1 ? (
                                                        <span className="label label-success">Đang mở</span>
                                                    ) : x.status === 2 ? (
                                                        <span className="label label-default">Tạm dừng</span>
                                                    ) : x.status === 3 ? (
                                                        <span className="label label-danger">Huỷ</span>
                                                    ) : (
                                                        <span className="label label-default">—</span>
                                                    )}
                                                </td>

                                                {/* Lịch học / Sync tháng — Admin only */}
                                                <td>
                                                    {isAdmin ? (
                                                        <div className="btn-group btn-group-xs" role="group">
                                                            <Link to={`/classes/${x.classID}/schedules`} className="btn btn-warning btn-xs">
                                                                <i className="fa fa-calendar" /> Xét lịch
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                className="btn btn-success btn-xs"
                                                                onClick={() => callSyncMonth(x.classID)}
                                                            >
                                                                <i className="fa fa-refresh" /> Lên lịch tháng
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
                                                </td>

                                                {/* Hành động — KHÔNG có nút xoá */}
                                                <td>
                                                    {isAdmin ? (
                                                        <div className="btn-group btn-group-xs" role="group">
                                                            <Link to={`/classes/${x.classID}/edit`} className="btn btn-primary btn-xs">
                                                                <i className="fa fa-edit" /> Cập nhật
                                                            </Link>
                                                            <Link to={`/classes/${x.classID}/students`} className="btn btn-info btn-xs">
                                                                <i className="fa fa-users" /> Xem học viên
                                                            </Link>
                                                            <Link to={`/classes/${x.classID}/available-students`} className="btn btn-success btn-xs">
                                                                <i className="fa fa-user-plus" /> Thêm học viên
                                                            </Link>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/classes/${x.classID}/students`} className="btn btn-info btn-xs">
                                                            <i className="fa fa-users" /> Xem học viên
                                                        </Link>
                                                    )}
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
