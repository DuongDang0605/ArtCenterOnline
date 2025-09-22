// src/Template/Student/StudentsPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getStudents } from "./students";
import { useAuth } from "../../auth/authCore";

export default function StudentsPage() {
    const { roles = [] } = useAuth();
    const isAdmin = roles.includes("Admin");

    const navigate = useNavigate();
    const location = useLocation();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    // === Toast thành công giống các trang khác ===
    const [notice, setNotice] = useState(location.state?.notice || "");
    useEffect(() => {
        if (location.state?.notice) {
            // clear route state để F5 không lặp lại
            setTimeout(() => {
                navigate(".", { replace: true, state: {} });
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Chuẩn hóa từng item từ API (hỗ trợ nhiều key khác nhau)
    const normalizeItem = (x, i) => {
        const pick = (...keys) => keys.find((k) => x?.[k] !== undefined) ?? null;

        const id = x[pick("studentId", "StudentId", "studentID", "StudentID", "id")] ?? i;
        const userId = x[pick("userId", "UserId")] ?? null;
        const email = x[pick("userEmail", "UserEmail", "email")] ?? "";

        const name = x[pick("studentName", "StudentName", "name")];
        const parent = x[pick("parentName", "ParentName")];
        const phone = x[pick("phoneNumber", "PhoneNumber", "PhoneNumer")];
        const address = x[pick("address", "Address", "adress", "Adress")];
        const startRaw = x[pick("ngayBatDauHoc", "startDate", "StartDate")];

        let startDate = "";
        if (startRaw) {
            try {
                const d = new Date(startRaw);
                if (!isNaN(d)) {
                    startDate = d.toLocaleDateString("vi-VN");
                } else {
                    const s = String(startRaw);
                    startDate = /^\d{4}-\d{2}-\d{2}/.test(s)
                        ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
                        : s;
                }
            } catch {
                startDate = String(startRaw);
            }
        }

        const learned = x[pick("soBuoiHocDaHoc", "SoBuoiHocDaHoc", "SoBuoiDaHoc")] ?? 0;
        const remaining = x[pick("soBuoiHocConLai", "SoBuoiHocConLai")] ?? 0;

        const rawStatus = x[pick("status", "Status", "statusNumber")] ?? 0;
        let statusNum = 0;
        if (typeof rawStatus === "number") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "boolean") statusNum = rawStatus ? 1 : 0;
        else if (typeof rawStatus === "string") {
            const s = rawStatus.trim().toLowerCase();
            statusNum = s === "1" || s === "active" || s === "đang học" ? 1 : 0;
        }

        return {
            id,
            userId,
            email,
            name: name ?? "",
            parent: parent ?? "",
            phone: phone ?? "",
            address: address ?? "",
            startDate,
            learned,
            remaining,
            statusNum,
        };
    };

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getStudents();
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

    // Init DataTable
    useEffect(() => {
        if (loading || err) return;

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
                { targets: 0, width: 80 },    // ID
                { targets: 1, width: 200 },   // User Email
                { targets: 7, width: 120 },   // Số buổi đã học
                { targets: 8, width: 120 },   // Số buổi còn lại
                { targets: 9, width: 120 },   // Trạng thái
                { targets: 10, width: 200 },  // Hành động
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
            {/* Toast thành công (tự ẩn sau 4s) */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            <section className="content-header">
                <h1>Danh sách học viên</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li className="active">Học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Bảng học viên</h3>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {err && <div className="alert alert-danger">{err}</div>}

                        {!loading && !err && (
                            <div className="table-responsive">
                                <table
                                    id="StudentsTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>User Email</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>Số điện thoại</th>
                                            <th>Địa chỉ</th>
                                            <th>Ngày nhập học</th>
                                            <th>Số buổi đã học</th>
                                            <th>Số buổi đã đóng</th>
                                            <th>Trạng thái</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.id}</td>
                                                <td>{r.email}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.startDate}</td>
                                                <td>{r.learned}</td>
                                                <td>{r.remaining}</td>
                                                <td>
                                                    <span className={"label " + (r.statusNum === 1 ? "label-success" : "label-default")}>
                                                        {r.statusNum === 1 ? "Đang học" : "Ngừng học"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {isAdmin ? (
                                                        <>
                                                            <Link to={`/students/${r.id}/edit`} className="btn btn-xs btn-primary">
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
        </>
    );
}
