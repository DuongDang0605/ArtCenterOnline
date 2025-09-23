// src/Template/Class/ClassStudentsInClassPage.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { getStudentsInClass, setClassStudentActive, exportStudentsInClass } from "../Class/classStudents";
import { getClass } from "../Class/classes";
import { useAuth } from "../../auth/authCore";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

function toVNDate(input) {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN");
}

function getFilenameFromDisposition(disposition) {
    if (!disposition) return null;
    // ví dụ: attachment; filename="hocvien-lop-12.xlsx"
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
    return m ? decodeURIComponent(m[1]) : null;
}

export default function ClassStudentsInClassPage() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const { showError, showSuccess, Toasts } = useToasts();

    const [rows, setRows] = useState([]);
    const [classInfo, setClassInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // Nhận flash/notice (đồng bộ như ClassesPage)
    useEffect(() => {
        const n = location?.state?.notice || location?.state?.flash;
        if (n) {
            showSuccess(String(n));
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

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Load data
    useEffect(() => {
        if (!isLoggedIn) return;
        let alive = true;
        (async () => {
            try {
                const [list, cls] = await Promise.all([getStudentsInClass(classId), getClass(classId)]);
                if (!alive) return;

                const className = cls?.className ?? cls?.ClassName ?? `#${classId}`;
                setClassInfo({ classId: Number(classId), className });

                const arr = Array.isArray(list) ? list : [];
                const norm = arr.map((x, i) => ({
                    studentId: x.StudentId ?? x.studentId ?? i,
                    name: x.StudentName ?? x.studentName ?? "",
                    email: x.userEmail ?? x.UserEmail ?? "", // <-- thêm email
                    parent: x.ParentName ?? x.parentName ?? "",
                    phone: x.PhoneNumber ?? x.phoneNumber ?? "",
                    address: x.adress ?? x.Adress ?? x.Address ?? "", // 'adress' legacy
                    startDate: toVNDate(x.StartDate ?? x.startDate ?? x.ngayBatDauHoc),
                    joinedDate: toVNDate(x.JoinedDate ?? x.joinedDate),
                    isActive: !!(x.IsActive ?? x.isActive),
                }));
                setRows(norm);
            } catch (e) {
                const s = e?.response?.status;
                if (s === 401) {
                    navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                    return;
                }
                showError(extractErr(e) || "Không tải được danh sách.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [classId, isLoggedIn, navigate]);

    // DataTable
    useEffect(() => {
        if (loading) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        if ($.fn.DataTable.isDataTable(el)) {
            try {
                $(el).DataTable().destroy();
            } catch {
                /* ignore */
            }
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
                order: [[1, "asc"]], // sort theo tên (cột 1: Tên học viên)
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
                    { targets: 2, width: 220 },  // Email
                    { targets: -1, width: 160, orderable: false }, // Hành động
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
            try {
                (window.jQuery || window.$)(el).DataTable().destroy();
            } catch {
                /* ignore */
            }
            dtRef.current = null;
        };
    }, [loading, rows]);

    // ======= Toggle + Confirm (cả TẮT & BẬT – chỉ Admin) =======
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [target, setTarget] = useState({ id: null, curr: true, name: "" });

    const askToggle = useCallback(
        (studentId, curr, name) => {
            if (!isAdmin) {
                showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
                return;
            }
            // Luôn xác nhận cả khi TẮT lẫn BẬT
            setTarget({ id: studentId, curr, name: name || `#${studentId}` });
            setConfirmOpen(true);
        },
        [isAdmin, showError]
    );

    async function doToggle(studentId, curr, name) {
        if (!isAdmin) {
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            return;
        }
        try {
            await setClassStudentActive(classId, studentId, !curr);
            setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, isActive: !curr } : r)));
            showSuccess(curr ? `Đã tắt trạng thái học viên ${name || `#${studentId}`}.` : `Đã bật trạng thái học viên ${name || `#${studentId}`}.`);
        } catch (e) {
            const s = e?.response?.status;
            if (s === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            showError(extractErr(e) || "Cập nhật trạng thái thất bại.");
        }
    }

    async function confirmProceed() {
        setConfirmBusy(true);
        try {
            await doToggle(target.id, target.curr, target.name);
        } finally {
            setConfirmBusy(false);
            setConfirmOpen(false);
            setTarget({ id: null, curr: true, name: "" });
        }
    }

    // ======= Export Excel (ConfirmDialog riêng, căn giữa, đẹp) =======
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);

    async function handleExport(includeInactive) {
        try {
            setExportBusy(true);
            const res = await exportStudentsInClass(classId, includeInactive);

            const cd = res.headers?.["content-disposition"] || res.headers?.get?.("content-disposition");
            const suggested = getFilenameFromDisposition(cd) || `hocvien-lop-${classId}.xlsx`;

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = suggested;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            showSuccess(`Đã xuất Excel (${includeInactive ? "gồm cả đã rời lớp" : "chỉ đang học"}).`);
        } catch (e) {
            const s = e?.response?.status;
            if (s === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            showError(extractErr(e) || "Xuất Excel thất bại.");
        } finally {
            setExportBusy(false);
            setExportConfirmOpen(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Học viên trong lớp {classInfo?.className}</h1>
                <ol className="breadcrumb">
                    <li>
                        <a href="#">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </a>
                    </li>
                    <li>
                        <Link to="/classes">Lớp học</Link>
                    </li>
                    <li className="active">Danh sách học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border" style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 className="box-title">Danh sách (có thể bật/tắt IsActive)</h3>
                        <div className="box-tools" style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn.success btn-sm btn-success" onClick={() => setExportConfirmOpen(true)}>
                                <i className="fa fa-file-excel-o" /> Xuất Excel
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}

                        {!loading && (
                            <div className="table-responsive">
                                <table id="ClassStudentsTable" ref={tableRef} className="table table-bordered table-hover" style={{ width: "100%" }}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Email</th>
                                            <th>Tên phụ huynh</th>
                                            <th>SĐT</th>
                                            <th>Địa chỉ</th>
                                            <th>Ngày nhập học</th>
                                            <th>Ngày vào lớp</th>
                                            <th>Trạng thái</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.studentId}>
                                                <td>{r.studentId}</td>
                                                <td>{r.name}</td>
                                                <td>{r.email}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.startDate}</td>
                                                <td>{r.joinedDate}</td>
                                                <td>
                                                    <span className={`label ${r.isActive ? "label-success" : "label-default"}`}>{r.isActive ? "Đang học" : "Ngừng học"}</span>
                                                </td>
                                                <td>
                                                    {isAdmin ? (
                                                        <button className={`btn btn-xs ${r.isActive ? "btn-warning" : "btn-success"}`} onClick={() => askToggle(r.studentId, r.isActive, r.name)}>
                                                            <i className="fa fa-toggle-on" /> {r.isActive ? "Nghỉ" : "Học"}
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-default btn-xs disabled" disabled title="Chỉ Admin được bật/tắt" style={{ cursor: "not-allowed", opacity: 0.6 }}>
                                                            <i className="fa fa-toggle-on" /> {r.isActive ? "Nghỉ" : "Học"}
                                                        </button>
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

            {/* Modal xác nhận khi BẬT/TẮT trạng thái — căn giữa, tiêu đề in đậm (ConfirmDialog) */}
            <ConfirmDialog
                open={confirmOpen}
                type={target.curr ? "warning" : "primary"}
                title="Xác nhận"
                message={
                    target.curr ? (
                        <>
                            Bạn sắp <b>tắt trạng thái</b> của học viên <b>{target.name}</b> trong lớp <b>{classInfo?.className}</b>. Học viên sẽ được đánh dấu <i>Ngừng học</i>. Tiếp tục?
                        </>
                    ) : (
                        <>
                            Bạn sắp <b>bật trạng thái</b> của học viên <b>{target.name}</b> trong lớp <b>{classInfo?.className}</b>. Học viên sẽ được đánh dấu <i>Đang học</i>. Tiếp tục?
                        </>
                    )
                }
                confirmText={target.curr ? "Tắt" : "Bật"}
                cancelText="Hủy"
                onCancel={() => !confirmBusy && setConfirmOpen(false)}
                onConfirm={confirmProceed}
                busy={confirmBusy}
            />

            {/* Modal xác nhận Export Excel — căn giữa, đẹp */}
            <ConfirmDialog
                open={exportConfirmOpen}
                type="primary"
                title="Xuất Excel"
                message={
                    <>
                        Bạn có muốn <b>bao gồm cả học viên đã rời lớp</b> (IsActive = false) trong file Excel xuất ra không?
                    </>
                }
                confirmText="Không, chỉ đang học"
                cancelText="Có, bao gồm"
                onCancel={() => !exportBusy && handleExport(true)}
                onConfirm={() => !exportBusy && handleExport(false)}
                busy={exportBusy}
            />

            {/* Toasts dùng chung */}
            <Toasts />
        </>
    );
}
