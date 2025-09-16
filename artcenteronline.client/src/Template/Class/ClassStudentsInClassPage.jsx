// src/Template/Class/ClassStudentsInClassPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getStudentsInClass, setClassStudentActive } from "../Class/classStudents";
import { getClass } from "../Class/classes";
import { useAuth } from "../../auth/authCore";

function extractError(e) {
    const res = e?.response;
    let msg =
        e?.userMessage ||
        res?.data?.message ||
        res?.data?.detail ||
        res?.data?.title ||
        (typeof res?.data === "string" ? res.data : null) ||
        e?.message ||
        "Có lỗi xảy ra.";
    if (!e?.userMessage && res?.data?.errors && typeof res.data.errors === "object") {
        const lines = [];
        for (const [field, arr] of Object.entries(res.data.errors)) {
            (arr || []).forEach((x) => lines.push(`${field}: ${x}`));
        }
        if (lines.length) msg = lines.join("\n");
    }
    return String(msg);
}

function toVNDate(input) {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN");
}

export default function ClassStudentsInClassPage() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const { isAdmin, isTeacher } = useAuth() || {};

    const [rows, setRows] = useState([]);
    const [classInfo, setClassInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // ==== Toasts có đồng hồ đếm ngược ====
    const AUTO_DISMISS = 5000;
    const [toastErr, setToastErr] = useState("");
    const [errRemain, setErrRemain] = useState(0);
    const [toastOk, setToastOk] = useState("");
    const [okRemain, setOkRemain] = useState(0);

    function showError(msg) {
        const text = (msg || "").trim();
        setToastErr(text);
        if (text) setErrRemain(AUTO_DISMISS);
    }
    function showOk(msg) {
        const text = (msg || "").trim();
        setToastOk(text);
        if (text) setOkRemain(AUTO_DISMISS);
    }

    useEffect(() => {
        if (!toastErr) return;
        const start = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - start));
            setErrRemain(left);
            if (left === 0) setToastErr("");
        }, 100);
        return () => clearInterval(iv);
    }, [toastErr]);

    useEffect(() => {
        if (!toastOk) return;
        const start = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - start));
            setOkRemain(left);
            if (left === 0) setToastOk("");
        }, 100);
        return () => clearInterval(iv);
    }, [toastOk]);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Load data
    useEffect(() => {
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
                    parent: x.ParentName ?? x.parentName ?? "",
                    phone: x.PhoneNumber ?? x.phoneNumber ?? "",
                    address: x.adress ?? x.Adress ?? x.Address ?? "", // chú ý 'adress'
                    startDate: toVNDate(x.StartDate ?? x.startDate ?? x.ngayBatDauHoc),
                    joinedDate: toVNDate(x.JoinedDate ?? x.joinedDate),
                    isActive: !!(x.IsActive ?? x.isActive),
                }));
                setRows(norm);
            } catch (e) {
                showError(extractError(e));
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [classId]);

    // DataTable
    useEffect(() => {
        if (loading) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        if ($.fn.DataTable.isDataTable(el)) {
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
                dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
                language: {
                    search: "Tìm kiếm:",
                    lengthMenu: "Hiện _MENU_ dòng",
                    info: "Hiển thị _START_-_END_ / _TOTAL_ dòng",
                    paginate: { previous: "Trước", next: "Sau" },
                    zeroRecords: "Không có dữ liệu",
                },
                columnDefs: [
                    { targets: 0, width: 80 },
                    { targets: -1, width: 160, orderable: false },
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

    // ======= Toggle + Confirm khi TẮT (Admin) =======
    const [togglingId, setTogglingId] = useState(null);
    const [confirm, setConfirm] = useState({ open: false, studentId: null, name: "", curr: true });
    const pendingNameRef = useRef("");

    function openConfirm(studentId, name, curr) {
        setConfirm({ open: true, studentId, name: name || `#${studentId}`, curr });
    }
    function closeConfirm() {
        setConfirm({ open: false, studentId: null, name: "", curr: true });
    }

    async function doToggle(studentId, curr) {
        if (togglingId) return;
        setTogglingId(studentId);
        try {
            await setClassStudentActive(classId, studentId, !curr);
            setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, isActive: !curr } : r));
            // Toast thành công
            const nm = pendingNameRef.current || `#${studentId}`;
            if (curr) {
                showOk(`Đã tắt trạng thái học viên ${nm}.`);
            } else {
                showOk(`Đã bật trạng thái học viên ${nm}.`);
            }
        } catch (e) {
            showError(extractError(e));
        } finally {
            setTogglingId(null);
            pendingNameRef.current = "";
        }
    }

    function handleToggleClick(studentId, curr, name) {
        // Admin tắt -> cảnh báo xác nhận
        if (isAdmin && curr === true) {
            openConfirm(studentId, name, curr);
            return;
        }
        // các trường hợp khác -> thao tác ngay
        pendingNameRef.current = name || `#${studentId}`;
        doToggle(studentId, curr);
    }

    function proceedConfirm() {
        pendingNameRef.current = confirm.name || `#${confirm.studentId}`;
        doToggle(confirm.studentId, confirm.curr);
        closeConfirm();
    }

    return (
        <>
            <section className="content-header">
                <h1>Học viên trong lớp {classInfo?.className}</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><Link to="/classes">Lớp học</Link></li>
                    <li className="active">Danh sách học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border" style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 className="box-title">Danh sách (có thể bật/tắt IsActive)</h3>
                        <div className="box-tools" style={{ display: "flex", gap: 8 }}>

                            <button className="btn btn-default btn-sm" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}

                        {!loading && (
                            <div className="table-responsive">
                                <table
                                    id="ClassStudentsTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>SĐT</th>
                                            <th>Địa chỉ</th>
                                            <th>Ngày nhập học</th>
                                            <th>Ngày vào lớp</th>
                                            <th>IsActive</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(r => (
                                            <tr key={r.studentId}>
                                                <td>{r.studentId}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.startDate}</td>
                                                <td>{r.joinedDate}</td>
                                                <td>
                                                    <span className={`label ${r.isActive ? "label-success" : "label-default"}`}>
                                                        {r.isActive ? "Đang học" : "Ngừng học"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className={`btn btn-xs ${r.isActive ? "btn-warning" : "btn-success"}`}
                                                        disabled={togglingId === r.studentId}
                                                        onClick={() => handleToggleClick(r.studentId, r.isActive, r.name)}
                                                    >
                                                        <i className="fa fa-toggle-on" /> {r.isActive ? "Tắt" : "Bật"}
                                                    </button>
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

            {/* ===== Modal xác nhận khi TẮT trạng thái (Admin) ===== */}
            {confirm.open && (
                <div className="modal fade in" style={{ display: "block", backgroundColor: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" onClick={closeConfirm}><span>&times;</span></button>
                                <h4 className="modal-title">
                                    <i className="fa fa-exclamation-triangle text-yellow" /> Xác nhận
                                </h4>
                            </div>
                            <div className="modal-body">
                                <p>
                                    Bạn sắp <b>tắt trạng thái</b> của học viên <b>{confirm.name}</b> trong lớp <b>{classInfo?.className}</b>.
                                    Học viên sẽ được đánh dấu <i>Ngừng học</i> và không được tính là đang active trong lớp. Tiếp tục?
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-default" onClick={closeConfirm}>Hủy</button>
                                <button className="btn btn-warning" onClick={proceedConfirm}>
                                    <i className="fa fa-toggle-off" /> Tắt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast lỗi nổi (đếm ngược + progress) */}
            {toastErr && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setToastErr("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>

                    <div style={{ whiteSpace: "pre-wrap" }}>{toastErr}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Tự ẩn sau {(errRemain / 1000).toFixed(1)}s</div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(errRemain / AUTO_DISMISS) * 100}%`,
                                background: "#a94442",
                                transition: "width 100ms linear"
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Toast thành công (đếm ngược + progress) */}
            {toastOk && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 120, right: 16, zIndex: 9998, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setToastOk("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>

                    <div style={{ whiteSpace: "pre-wrap" }}>{toastOk}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Tự ẩn sau {(okRemain / 1000).toFixed(1)}s</div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(okRemain / AUTO_DISMISS) * 100}%`,
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
