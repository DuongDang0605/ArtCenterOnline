// src/Template/Teacher/TeachersPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { getTeachers } from "./Teachers";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/authCore"; // thêm

export default function TeachersPage() {
    const { roles = [] } = useAuth();
    const isAdmin = roles.includes("Admin");

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    const normalizeItem = (x, i) => {
        const pick = (...keys) => keys.find(k => x?.[k] !== undefined) ?? null;
        const id = x[pick("teacherId", "TeacherId", "id")] ?? i;
        const userId = x[pick("userId", "UserId")];
        const name = x[pick("teacherName", "TeacherName", "name")];
        const phone = x[pick("phoneNumber", "PhoneNumber", "phone")];
        const sessionsPerMonth = x[pick("soBuoiDayTrongThang", "SoBuoiDayTrongThang", "sessionsPerMonth")] ?? 0;
        const rawStatus = x[pick("status", "Status", "statusNumber")] ?? 0;
        let statusNum = 0;
        if (typeof rawStatus === "number") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "boolean") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "string") {
            const s = rawStatus.trim().toLowerCase();
            statusNum = (s === "1" || s === "active" || s === "đang dạy" || s === "đang hoạt động") ? 1 : 0;
        }
        const email = x[pick("userEmail", "UserEmail", "email")] ?? "";
        return { id, userId: userId ?? "", name: name ?? "", phone: phone ?? "", sessionsPerMonth, statusNum, email };
    };

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getTeachers();
                if (!alive) return;
                const arr = Array.isArray(data) ? data : [];
                const normalized = arr.map((x, i) => normalizeItem(x, i));
                setRows(normalized);
            } catch (e) {
                if (alive) setErr(e?.message || "Fetch failed");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (loading || err) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!$?.fn?.DataTable || !el) return;
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
                decimal: ",", thousands: ".", emptyTable: "Không có dữ liệu",
                info: "Hiển thị _START_–_END_ trên tổng _TOTAL_ dòng",
                infoEmpty: "Hiển thị 0–0 trên tổng 0 dòng",
                infoFiltered: "(lọc từ _MAX_ dòng)",
                lengthMenu: "Hiện _MENU_ dòng", loadingRecords: "Đang tải...",
                processing: "Đang xử lý...", search: "Tìm kiếm:",
                zeroRecords: "Không tìm thấy kết quả phù hợp",
                paginate: { first: "Đầu", last: "Cuối", next: "Sau", previous: "Trước" },
                aria: { sortAscending: ": sắp xếp tăng dần", sortDescending: ": sắp xếp giảm dần" },
            },
            columnDefs: [
                { targets: 0, width: 80 },
                { targets: 1, width: 160 },
                { targets: 3, width: 160 },
                { targets: 4, width: 160 },
                { targets: 5, width: 120 },
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
    }, [loading, err, rows]);

    return (
        <>
            <section className="content-header">
                <h1>Danh sách giáo viên</h1>
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
                        {err && <p className="text-red">Lỗi: {err}</p>}
                        {!loading && !err && (
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
                                            <th>Số điện thoại</th>
                                            <th>Số buổi dạy/tháng</th>
                                            <th>Trạng thái</th>
                                            <th>Hành Động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.id}</td>
                                                <td>{r.email}</td>
                                                <td>{r.name}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.sessionsPerMonth}</td>
                                                <td>
                                                    <span className={`label ${r.statusNum === 1 ? "label-success" : "label-default"}`}>
                                                        {r.statusNum === 1 ? "Đang dạy" : "Ngừng dạy"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {isAdmin ? (
                                                        <>
                                                            <Link to={`/teachers/${r.id}/edit`} className="btn btn-xs btn-primary">
                                                                <i className="fa fa-edit" /> Cập nhật
                                                            </Link>{" "}
                                                            <Link to={`/users/${r.userId}/edit`} className="btn btn-xs btn-info">
                                                                <i className="fa fa-user" /> Sửa User
                                                            </Link>
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
        </>
    );
}
