// src/Template/Class/ClassAvailableStudentsPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { addStudentToClass, addStudentsToClassBatch } from "./classStudents";
import { getActiveStudentsNotInClass } from "../Student/Students";
import { getClass } from "./classes";                       // đồng bộ path với các trang khác
import { useAuth } from "../../auth/authCore";
import extractErr from "../../utils/extractErr";
import ConfirmDialog from "../../component/ConfirmDialog";
import { useToasts } from "../../hooks/useToasts";

export default function ClassAvailableStudentsPage() {
    const { classId } = useParams();
    const navigate = useNavigate();

    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const { showError, showSuccess, Toasts } = useToasts();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hardErr, setHardErr] = useState("");     // lỗi chặn hiển thị bảng
    const [selected, setSelected] = useState(new Set());
    const [classInfo, setClassInfo] = useState(null);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Guard
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
            return;
        }
        if (!isAdmin) {
            setHardErr("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            setLoading(false);
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, isAdmin]);

    // Chuẩn hoá item
    const normalize = (x, i) => {
        const pick = (...keys) => keys.find((k) => x?.[k] !== undefined) ?? null;
        const id = x[pick("studentId", "StudentId", "studentID", "StudentID", "id")] ?? i;
        const name = x[pick("studentName", "StudentName", "name")] ?? "";
        const parent = x[pick("parentName", "ParentName")] ?? "";
        const phone = x[pick("phoneNumber", "PhoneNumber", "PhoneNumer")] ?? "";
        const address = x[pick("address", "Address", "adress", "Adress")] ?? "";
        const startRaw = x[pick("ngayBatDauHoc", "startDate", "StartDate")];
        const email = x[pick("userEmail", "UserEmail")] ?? "";
        let startDate = "";
        if (startRaw) {
            try {
                const d = new Date(startRaw);
                startDate = isNaN(d) ? String(startRaw) : d.toLocaleDateString("vi-VN");
            } catch {
                startDate = String(startRaw);
            }
        }
        return { id, name, parent, phone, address, startDate, email };
    };

    // Load data
    useEffect(() => {
        if (!isLoggedIn || !isAdmin) return;
        let alive = true;
        (async () => {
            try {
                const [data, cls] = await Promise.all([
                    getActiveStudentsNotInClass(classId),
                    getClass(classId),
                ]);
                if (!alive) return;
                const ClassName = cls?.ClassName ?? cls?.className ?? `#${classId}`;
                setClassInfo({ classId, ClassName });
                const arr = Array.isArray(data) ? data : [];
                setRows(arr.map((x, i) => normalize(x, i)));
            } catch (e) {
                if (!alive) return;
                const s = e?.response?.status;
                if (s === 401) {
                    navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                    return;
                }
                const msg = extractErr(e);
                setHardErr(msg);
                showError(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classId, isLoggedIn, isAdmin]);

    // DataTable
    useEffect(() => {
        if (loading || hardErr || !isAdmin) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        const $table = $(el);
        if ($.fn.DataTable.isDataTable(el)) {
            try { $table.DataTable().destroy(); } catch { /* ignore */ }
        }

        const dt = $table.DataTable({
            autoWidth: false,
            lengthChange: true,
            searching: true,
            ordering: true,
            paging: true,
            info: true,
            pageLength: 10,
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
                { targets: 0, width: 30, orderable: false },
                { targets: -1, width: 140, orderable: false },
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
            try { dt.destroy(); } catch { /* ignore */ }
            dtRef.current = null;
        };
    }, [loading, hardErr, rows, isAdmin]);

    // ===== Select helpers =====
    const toggleSelect = (id, checked) => {
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        setSelected(next);
    };

    // ===== Xác nhận & hành động: Thêm 1 =====
    const [confirmOneOpen, setConfirmOneOpen] = useState(false);
    const [targetStudentId, setTargetStudentId] = useState(null);
    const [busyOne, setBusyOne] = useState(false);

    function askAddOne(id) {
        setTargetStudentId(id);
        setConfirmOneOpen(true);
    }

    async function doAddOne() {
        if (!targetStudentId) return;
        if (!isAdmin) { showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
        setBusyOne(true);
        try {
            await addStudentToClass(classId, targetStudentId);
            // Điều hướng về /classes kèm notice để trang đích show toast thành công đồng bộ
            navigate("/classes", { replace: true, state: { notice: "Cập nhật danh sách lớp thành công" } });
        } catch (e) {
            if (e?.response?.status === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            showError(extractErr(e) || "Thêm học viên thất bại");
        } finally {
            setBusyOne(false);
            setConfirmOneOpen(false);
            setTargetStudentId(null);
        }
    }

    // ===== Xác nhận & hành động: Thêm nhiều =====
    const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
    const [busyBatch, setBusyBatch] = useState(false);

    function askAddSelected() {
        if (selected.size === 0) {
            showError("Vui lòng chọn ít nhất 1 học viên.");
            return;
        }
        setConfirmBatchOpen(true);
    }

    async function doAddSelected() {
        if (selected.size === 0) return;
        if (!isAdmin) { showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
        setBusyBatch(true);
        try {
            await addStudentsToClassBatch(classId, Array.from(selected));
            navigate("/classes", { replace: true, state: { notice: "Cập nhật danh sách lớp thành công" } });
        } catch (e) {
            if (e?.response?.status === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            showError(extractErr(e) || "Thêm học viên (nhiều) thất bại");
        } finally {
            setBusyBatch(false);
            setConfirmBatchOpen(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Học viên chưa thuộc lớp {classInfo?.ClassName}</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><Link to="/classes">Lớp học</Link></li>
                    <li className="active">Thêm học viên vào lớp</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border" style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 className="box-title">Danh sách (chỉ “Đang học” & chưa thuộc lớp)</h3>
                        <div className="box-tools" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={askAddSelected}
                                disabled={!isAdmin || selected.size === 0}
                                title={selected.size ? `Thêm ${selected.size} học viên đã chọn` : "Chọn học viên để thêm"}
                            >
                                <i className="fa fa-user-plus" /> Thêm ({selected.size}) đã chọn
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {hardErr && (
                            <p className="text-red" style={{ whiteSpace: "pre-wrap" }}>
                                Lỗi: {hardErr}
                            </p>
                        )}

                        {!loading && !hardErr && isAdmin && (
                            <div className="table-responsive">
                                <table
                                    id="AvailableStudentsTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const ckd = e.target.checked;
                                                        if (ckd) setSelected(new Set(rows.map((r) => r.id)));
                                                        else setSelected(new Set());
                                                    }}
                                                    checked={rows.length > 0 && selected.size === rows.length}
                                                    aria-label="Chọn tất cả"
                                                />
                                            </th>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>Số điện thoại</th>
                                            <th>Địa chỉ</th>
                                            <th>Email</th>
                                            <th>Ngày nhập học</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(r.id)}
                                                        onChange={(e) => toggleSelect(r.id, e.target.checked)}
                                                        aria-label={`Chọn ${r.name}`}
                                                    />
                                                </td>
                                                <td>{r.id}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.email}</td>
                                                <td>{r.startDate}</td>
                                                <td>
                                                    {isAdmin ? (
                                                        <button className="btn btn-xs btn-success" onClick={() => askAddOne(r.id)}>
                                                            <i className="fa fa-user-plus" /> Thêm
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-xs btn-default disabled" disabled title="Chỉ Admin được thêm">
                                                            <i className="fa fa-user-plus" /> Thêm
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

            {/* Modal xác nhận: thêm 1 */}
            <ConfirmDialog
                open={confirmOneOpen}
                type="primary"
                title="Xác nhận thêm học viên"
                message={`Thêm học viên #${targetStudentId} vào lớp ${classInfo?.ClassName || `#${classId}`}?`}
                confirmText="Thêm"
                cancelText="Để sau"
                onCancel={() => { if (!busyOne) { setConfirmOneOpen(false); setTargetStudentId(null); } }}
                onConfirm={doAddOne}
                busy={busyOne}
            />

            {/* Modal xác nhận: thêm nhiều */}
            <ConfirmDialog
                open={confirmBatchOpen}
                type="primary"
                title="Xác nhận thêm nhiều học viên"
                message={`Thêm ${selected.size} học viên đã chọn vào lớp ${classInfo?.ClassName || `#${classId}`}?`}
                details="Bạn có thể quản lý học viên trong lớp ở trang 'Xem học viên'."
                confirmText="Thêm"
                cancelText="Huỷ"
                onCancel={() => { if (!busyBatch) setConfirmBatchOpen(false); }}
                onConfirm={doAddSelected}
                busy={busyBatch}
            />

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
