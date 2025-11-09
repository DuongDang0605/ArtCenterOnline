// src/Template/Teacher/TeachersPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getTeachers } from "./teachers";
import { useAuth } from "../../auth/authCore";

// 🔁 Đồng bộ theo pattern AddClassPage/StudentsPage:
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function TeachersPage() {
    // Lấy roles + teacherId giống SessionsPage
    const auth = useAuth();
    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");
    const myTeacherId =
        auth?.user?.teacherId ??
        auth?.user?.TeacherId ??
        auth?.user?.teacher?.teacherId ??
        auth?.user?.teacher?.TeacherId ?? "";


    const navigate = useNavigate();
    const location = useLocation();

    const { showError, showSuccess, Toasts } = useToasts();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Nhận notice từ các trang khác chuyển về (giống StudentsPage)
    useEffect(() => {
        const notice = location.state?.notice;
        if (notice) {
            showSuccess(notice);
            // clear route state để F5 không lặp lại
            navigate(".", { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const normalizeItem = (x, i) => {
        const pick = (...keys) => keys.find((k) => x?.[k] !== undefined) ?? null;

        const id = x[pick("teacherId", "TeacherId", "id")] ?? i;
        const userId = x[pick("userId", "UserId")] ?? "";
        const name = x[pick("teacherName", "TeacherName", "name")] ?? "";
        const phone = x[pick("phoneNumber", "PhoneNumber", "phone")] ?? "";
        const soBuoiDayThangTruoc = x[pick("SoBuoiDayThangTruoc", "soBuoiDayThangTruoc")];
        const sessionsPerMonth = x["sessionsThisMonth"] ?? 0;

        const rawStatus = x[pick("status", "Status", "statusNumber")] ?? 0;
        let statusNum = 0;
        if (typeof rawStatus === "number") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "boolean") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "string") {
            const s = rawStatus.trim().toLowerCase();
            statusNum = s === "1" || s === "active" || s === "đang dạy" || s === "đang hoạt động" ? 1 : 0;
        }

        const email = x[pick("userEmail", "UserEmail", "email")] ?? "";
        return { id, userId, name, phone, sessionsPerMonth, soBuoiDayThangTruoc, statusNum, email };
    };

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getTeachers();
                if (!alive) return;
                const normalized = (Array.isArray(data) ? data : []).map((x, i) => normalizeItem(x, i));

                // Nếu là giáo viên: chỉ cho xem đúng bản ghi của chính mình
                if (isTeacher) {
                    const mineId = String(myTeacherId || "");
                    const onlyMe = normalized.filter(r => String(r.id) === mineId);
                    setRows(onlyMe);
                } else {
                    setRows(normalized);
                }
            } catch (e) {
                showError(extractErr(e) || "Không tải được danh sách giáo viên.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId]);
    // Init DataTable
    useEffect(() => {
        if (loading) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!$.fn?.DataTable || !el) return;

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
                { targets: 0, width: 80 },   // ID
                { targets: 1, width: 200 },  // User Email
                { targets: 3, width: 160 },  // Phone
                { targets: 4, width: 160 },  // Sessions this month
                { targets: 5, width: 120 },  // Status
                { targets: 6, width: 200 },  // Actions
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
            try { dt.destroy(true); } catch { /* empty */ }
            dtRef.current = null;
        };
    }, [loading, rows]);

    return (
        <>
            <section className="content-header">
                <h1>
                    {isTeacher
                        ? "Thông tin giáo viên (của tôi)"
                        : "Danh sách giáo viên"}
                </h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li className="active">Giáo viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Bảng giáo viên</h3>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}

                        {!loading && (
                            <div className="table-responsive">
                                <table
                                    id="TeachersTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>User Email</th>
                                            <th>Tên giáo viên</th>
                                            <th>Buổi trong tháng</th>
                                            <th>Trạng thái</th>
                                            <th>Ghi chú</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.id}</td>
                                                <td>{r.email}</td>
                                                <td>{r.name}</td>
                                                <td>{r.sessionsPerMonth}</td>
                                                <td>
                                                    <span className={"label " + (r.statusNum === 1 ? "label-success" : "label-default")}>
                                                        {r.statusNum === 1 ? "Đang dạy" : "Ngừng dạy"}
                                                    </span>
                                                </td>
                                                <td>{r.phone}</td>
                                                <td>
                                                    {isAdmin ? (
                                                        <>
                                                            <Link to={`/teachers/${r.id}/edit`} className="btn btn-xs btn-primary">
                                                                <i className="fa fa-edit" /> Cập nhật
                                                            </Link>{" "}
                                                            {r.userId ? (
                                                                <Link to={`/users/${r.userId}/edit`} className="btn btn-xs btn-info">
                                                                    <i className="fa fa-user" /> Sửa User
                                                                </Link>
                                                            ) : (
                                                                <span className="text-muted">Không có User</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-muted">—</span>
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

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
