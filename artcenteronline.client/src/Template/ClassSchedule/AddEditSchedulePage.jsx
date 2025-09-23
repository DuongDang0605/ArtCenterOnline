// src/Template/ClassSchedule/AddEditSchedulePage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    createSchedule,
    getSchedule,
    updateSchedule,
    checkStudentOverlapForSchedule,
} from "./schedules";
import OverlapWarningModal from "../../component/OverlapWarningModal";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

const VI_DOW = [
    { v: 0, t: "Chủ nhật" },
    { v: 1, t: "Thứ 2" },
    { v: 2, t: "Thứ 3" },
    { v: 3, t: "Thứ 4" },
    { v: 4, t: "Thứ 5" },
    { v: 5, t: "Thứ 6" },
    { v: 6, t: "Thứ 7" },
];

let fetchTeachers = async () => [];
try {
    const modPromise = import("../Teacher/teachers");
    fetchTeachers = async () => {
        try {
            const mod = await modPromise;
            return typeof mod.getTeachers === "function" ? mod.getTeachers() : [];
        } catch {
            return [];
        }
    };
} catch { /* ignore */ }

function pad2(n) { return String(n).padStart(2, "0"); }
function toTimeInput(s) {
    if (!s) return "";
    const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (m) return `${m[1]}:${m[2]}`;
    const d = new Date(`1970-01-01T${s}`);
    if (isNaN(d)) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function AddEditSchedulePage() {
    const { classId, id } = useParams();
    const nav = useNavigate();

    const { showError, showSuccess, Toasts } = useToasts();

    const [form, setForm] = useState({
        classID: Number(classId),
        dayOfWeek: 1,
        startTime: "18:00",
        endTime: "20:00",
        note: "",
        isActive: true,
        teacherId: "",
    });
    const [teachers, setTeachers] = useState([]);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Modal cảnh báo trùng HS
    const [warnings, setWarnings] = useState([]);
    // Modal xác nhận khi KHÔNG trùng
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmBusy, setConfirmBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const ts = await fetchTeachers();
                if (alive) setTeachers(Array.isArray(ts) ? ts : []);
                if (id) {
                    const data = await getSchedule(id);
                    if (!alive) return;
                    setForm({
                        classID: data.classID ?? data.ClassID ?? Number(classId),
                        dayOfWeek: data.dayOfWeek ?? data.DayOfWeek ?? 1,
                        startTime: (data.startTime || data.StartTime || "").slice(0, 5) || "18:00",
                        endTime: (data.endTime || data.EndTime || "").slice(0, 5) || "20:00",
                        note: data.note || data.Note || "",
                        isActive: !!(data.isActive ?? data.IsActive ?? true),
                        teacherId: data.teacherId ?? data.TeacherId ?? "",
                    });
                }
            } catch (e) {
                showError(extractErr(e) || "Không tải được dữ liệu.");
            } finally {
                setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, classId]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? !!checked : value }));
    };

    function validate() {
        if (!form.dayOfWeek && form.dayOfWeek !== 0) return "Vui lòng chọn thứ.";
        if (form.teacherId === "" || form.teacherId == null) return "Vui lòng chọn giáo viên.";
        const s = new Date(`1970-01-01T${toTimeInput(form.startTime)}:00`);
        const e = new Date(`1970-01-01T${toTimeInput(form.endTime)}:00`);
        if (!(s < e)) return "Giờ kết thúc phải lớn hơn giờ bắt đầu.";
        return "";
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        showError(""); // clear toasts cũ nếu có

        const v = validate();
        if (v) { showError(v); return; }

        try {
            setSaving(true);

            // 1) Preflight: kiểm tra trùng học sinh cho cả THÊM và SỬA
            //    - Nếu CÓ trùng -> chỉ mở OverlapWarningModal và DỪNG (không xác nhận thêm)
            //    - Nếu KHÔNG trùng -> mở ConfirmDialog rồi mới lưu (đồng bộ 2 file mẫu)
            const warn = id
                ? await checkStudentOverlapForSchedule(id)
                : await checkStudentOverlapForSchedule(null, {
                    classID: Number(form.classID),
                    dayOfWeek: Number(form.dayOfWeek),
                    startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
                    endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
                    teacherId: form.teacherId === "" ? null : Number(form.teacherId),
                    isActive: !!form.isActive,
                });

            if (Array.isArray(warn) && warn.length) {
                setWarnings(warn);            // chỉ hiện modal cảnh báo trùng HS
                setSaving(false);
                return;
            }

            // Không có trùng -> bật xác nhận
            setConfirmOpen(true);
            setSaving(false);
        } catch (e) {
            setSaving(false);
            showError(extractErr(e) || "Không kiểm tra được trùng lịch.");
        }
    }

    async function doPersist() {
        // Gọi khi người dùng ấn "Lưu" trong ConfirmDialog
        setConfirmBusy(true);
        try {
            const payload = {
                classID: Number(form.classID),
                dayOfWeek: Number(form.dayOfWeek),
                startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
                endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
                note: form.note?.trim() || "",
                isActive: !!form.isActive,
                teacherId: form.teacherId === "" ? null : Number(form.teacherId),
            };

            if (id) {
                await updateSchedule(id, payload);
                showSuccess("Đã cập nhật lịch học."); // hiển thị ngay
                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã cập nhật lịch học." } });
            } else {
                await createSchedule(payload);
                showSuccess("Đã thêm lịch học mới.");
                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã thêm lịch học mới." } });
            }
        } catch (e) {
            showError(extractErr(e) || "Lưu lịch học thất bại.");
        } finally {
            setConfirmBusy(false);
            setConfirmOpen(false);
        }
    }

    if (loading) {
        return (
            <>
                <section className="content">
                    <div className="box">
                        <div className="box-body">Đang tải…</div>
                    </div>
                </section>
                <Toasts />
            </>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>{id ? "Sửa lịch học" : "Thêm lịch học"}</h1>
                <ol className="breadcrumb">
                    <li><Link to="/">Trang chủ</Link></li>
                    <li><Link to={`/classes/${form.classID}/schedules`}>Lịch học</Link></li>
                    <li className="active">{id ? "Sửa" : "Thêm"}</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <form onSubmit={onSubmit}>
                        <div className="box-header with-border">
                            <h3 className="box-title">Thông tin lịch</h3>
                        </div>

                        <div className="box-body">
                            <div className="row">
                                {/* Thứ */}
                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Thứ trong tuần</label>
                                        <select
                                            name="dayOfWeek"
                                            className="form-control"
                                            value={form.dayOfWeek}
                                            onChange={onChange}
                                            required
                                        >
                                            {VI_DOW.map((d) => (
                                                <option key={d.v} value={d.v}>{d.t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Giáo viên */}
                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Giáo viên</label>
                                        <select
                                            name="teacherId"
                                            className="form-control"
                                            value={form.teacherId}
                                            onChange={onChange}
                                            required
                                        >
                                            <option value="">-- Chọn giáo viên --</option>
                                            {teachers.map((t) => {
                                                const idv = t.teacherId ?? t.TeacherId;
                                                const name = t.teacherName ?? t.fullName ?? t.FullName ?? `(GV #${idv})`;
                                                const st = (t.status ?? t.Status ?? (t.isActive ? 1 : 0)); // 1=đang dạy
                                                const isDisabled = st !== 1;
                                                return (
                                                    <option
                                                        key={idv}
                                                        value={idv}
                                                        disabled={isDisabled}
                                                        title={isDisabled ? "Giáo viên ngừng dạy" : "Đang dạy"}
                                                        style={isDisabled ? { color: "#999" } : undefined}
                                                    >
                                                        {name}{isDisabled ? " [Ngừng]" : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {/* Giờ */}
                                <div className="col-sm-2">
                                    <div className="form-group">
                                        <label>Giờ bắt đầu</label>
                                        <input
                                            className="form-control"
                                            type="time"
                                            name="startTime"
                                            value={toTimeInput(form.startTime)}
                                            onChange={onChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="col-sm-2">
                                    <div className="form-group">
                                        <label>Giờ kết thúc</label>
                                        <input
                                            className="form-control"
                                            type="time"
                                            name="endTime"
                                            value={toTimeInput(form.endTime)}
                                            onChange={onChange}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Ghi chú + kích hoạt */}
                            <div className="form-group">
                                <label>Ghi chú</label>
                                <input className="form-control" name="note" value={form.note} onChange={onChange} />
                            </div>

                            <div className="checkbox">
                                <label>
                                    <input type="checkbox" name="isActive" checked={!!form.isActive} onChange={onChange} /> Kích hoạt
                                </label>
                                {!form.isActive && (
                                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                                        * Lịch đang tắt: hệ thống không kiểm tra trùng. Khi bật lại sẽ kiểm tra.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="box-footer">
                            <button type="submit" className="btn btn-primary" disabled={saving || confirmBusy}>
                                <i className="fa fa-save" /> Lưu
                            </button>
                            <Link to={`/classes/${form.classID}/schedules`} className="btn btn-default" style={{ marginLeft: 10 }}>
                                Hủy
                            </Link>
                        </div>
                    </form>
                </div>
            </section>

            {/* Modal cảnh báo học sinh trùng — CHỈ hiển thị, không xác nhận thêm */}
            {warnings.length > 0 && (
                <OverlapWarningModal
                    open
                    title="Cảnh báo trùng học sinh"
                    warnings={warnings}
                    onCancel={() => setWarnings([])}
                    onConfirm={async () => {
                        setWarnings([]);
                        try {
                            setSaving(true);
                            const payload = {
                                classID: Number(form.classID),
                                dayOfWeek: Number(form.dayOfWeek),
                                startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
                                endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
                                note: form.note?.trim() || "",
                                isActive: !!form.isActive,
                                teacherId: form.teacherId === "" ? null : Number(form.teacherId),
                                // QUAN TRỌNG: thêm cờ override để BE cho phép lưu khi đã xác nhận
                                OverrideStudentConflicts: true,
                            };

                            if (id) {
                                await updateSchedule(id, payload, { override: true });
                                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã cập nhật lịch học." } });
                            } else {
                                await createSchedule(payload, { override: true });
                                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã thêm lịch học mới." } });
                            }
                        } catch (e) {
                            showError(extractErr(e));
                        } finally {
                            setSaving(false);
                        }
                    }}
                />

            )}

            {/* Modal xác nhận — CHỈ khi KHÔNG có trùng học sinh */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title={id ? "Xác nhận cập nhật lịch học" : "Xác nhận tạo lịch học"} // tiêu đề in đậm, căn giữa
                message={
                    id
                        ? "Lưu các thay đổi cho lịch học này?"
                        : "Tạo lịch học mới với thông tin đã nhập?"
                }
                confirmText={id ? "Lưu" : "Tạo mới"}
                cancelText="Xem lại"
                onCancel={() => !confirmBusy && setConfirmOpen(false)}
                onConfirm={doPersist}
                busy={confirmBusy}
            />

            {/* Toasts (success + error) dùng chung, đồng bộ với AddClassPage/ClassesPage */}
            <Toasts />
        </>
    );
}
