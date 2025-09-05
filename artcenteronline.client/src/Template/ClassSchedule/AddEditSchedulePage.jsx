// src/Template/ClassSchedule/AddEditSchedulePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    createSchedule,
    getSchedule,
    updateSchedule,
    checkStudentOverlapForSchedule,
} from "./schedules";
import OverlapWarningModal from "../../component/OverlapWarningModal";

const VI_DOW = [
    { v: 0, t: "Chủ nhật" },
    { v: 1, t: "Thứ 2" },
    { v: 2, t: "Thứ 3" },
    { v: 3, t: "Thứ 4" },
    { v: 4, t: "Thứ 5" },
    { v: 5, t: "Thứ 6" },
    { v: 6, t: "Thứ 7" },
];

// (tuỳ chọn) nạp danh sách GV động để không vỡ import khi thiếu module
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
    const [err, setErr] = useState("");
    const [warnings, setWarnings] = useState([]);

    // ==== Toast lỗi tự ẩn + clear khi đổi field ====
    const AUTO_DISMISS = 5000; // ms
    const errTimerRef = useRef(null);

    const showError = (msg) => {
        if (errTimerRef.current) {
            clearTimeout(errTimerRef.current);
            errTimerRef.current = null;
        }
        setErr(msg || "");
        if (msg) {
            errTimerRef.current = setTimeout(() => {
                setErr("");
                errTimerRef.current = null;
            }, AUTO_DISMISS);
        }
    };

    useEffect(() => {
        return () => { if (errTimerRef.current) clearTimeout(errTimerRef.current); };
    }, []);

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
                showError(e?.response?.data?.message || e.message || "Lỗi tải dữ liệu.");
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
        if (err) showError(""); // đổi gì cũng clear lỗi
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
        showError("");

        const v = validate();
        if (v) return showError(v);

        const payload = {
            classID: Number(form.classID),
            dayOfWeek: Number(form.dayOfWeek),
            startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
            endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
            note: form.note?.trim() || "",
            isActive: !!form.isActive,
            teacherId: form.teacherId === "" ? null : Number(form.teacherId),
        };

        try {
            setSaving(true);

            // cảnh báo trùng học sinh khi EDIT (giữ flow cũ)
            if (id) {
                const warn = await checkStudentOverlapForSchedule(id);
                if (Array.isArray(warn) && warn.length) {
                    setWarnings(warn);
                    setSaving(false);
                    return;
                }
            }

            if (id) {
                await updateSchedule(id, payload);
                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã cập nhật lịch học." } });
            } else {
                await createSchedule(payload);
                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã thêm lịch học mới." } });
            }
        } catch (e) {
            const res = e?.response;
            const msg =
                res?.data?.message ||
                res?.data?.detail ||
                res?.data?.title ||
                (typeof res?.data === "string" ? res.data : null) ||
                e?.message ||
                "Có lỗi xảy ra khi lưu.";
            showError(String(msg));
        } finally {
            setSaving(false);
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

                {err && (
                    <div
                        className="alert alert-danger"
                        style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                    >
                        <button type="button" className="close" onClick={() => showError("")}><span aria-hidden="true">&times;</span></button>
                        {err}
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Tự ẩn sau {AUTO_DISMISS / 1000}s</div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            {/* KHÔNG bọc content bằng .content-wrapper nữa (Layout đã có sẵn) */}
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
                                                return <option key={idv} value={idv}>{name}</option>;
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
                            </div>
                        </div>

                        <div className="box-footer">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <i className="fa fa-save" /> Lưu
                            </button>
                            <Link to={`/classes/${form.classID}/schedules`} className="btn btn-default" style={{ marginLeft: 10 }}>
                                Hủy
                            </Link>
                        </div>
                    </form>
                </div>
            </section>

            {/* Toast lỗi nổi (tự ẩn sau 5s) */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => showError("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {err}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Tự ẩn sau {AUTO_DISMISS / 1000}s</div>
                </div>
            )}

            {/* Modal cảnh báo học sinh trùng (giữ flow cũ) */}
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
                            };
                            if (id) {
                                await updateSchedule(id, payload);
                                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã cập nhật lịch học." } });
                            } else {
                                await createSchedule(payload);
                                nav(`/classes/${form.classID}/schedules`, { state: { notice: "Đã thêm lịch học mới." } });
                            }
                        } catch (e) {
                            showError(e?.response?.data?.message || e.message || "Có lỗi xảy ra khi lưu.");
                        } finally {
                            setSaving(false);
                        }
                    }}
                />
            )}
        </>
    );
}