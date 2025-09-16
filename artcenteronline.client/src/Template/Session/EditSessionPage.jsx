// src/Template/Session/EditSessionPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession, updateSession, checkStudentOverlapForSession } from "./sessions";
import { getTeachers } from "../Teacher/teachers";
import { useAuth } from "../../auth/authCore";
import OverlapWarningModal from "../../component/OverlapWarningModal";

/* ===== helpers ===== */
function isoToDMY(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
}
function dmyToISO(dmy) {
    if (!dmy) return "";
    const parts = dmy.split("/");
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function HHMM(t) {
    if (!t) return "";
    const [hh, mm] = String(t).split(":");
    return `${String(hh).padStart(2, "0")}:${String(mm || "0").padStart(2, "0")}`;
}
function pickErr(e) {
    return (
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.response?.data?.title ||
        e?.message ||
        "Đã có lỗi xảy ra."
    );
}
/** Convert BE conflicts (object[]) -> string[] cho OverlapWarningModal */
function conflictsToWarnings(conflicts) {
    if (!Array.isArray(conflicts)) return [];
    return conflicts.map((it) => {
        const sid = it.studentId ?? it.StudentId ?? "";
        const sname = it.studentName ?? it.StudentName ?? (sid ? `Học sinh #${sid}` : "Học sinh");
        const c = it.conflict ?? it.Conflict ?? {};
        const cid = c.classId ?? c.ClassId ?? "";
        const cname = c.className ?? c.ClassName ?? (cid ? `Lớp #${cid}` : "lớp khác");
        const date = c.date ?? c.Date ?? "";
        const start = c.start ?? c.Start ?? "";
        const end = c.end ?? c.End ?? "";
        const slot = [date, [start, end].filter(Boolean).join("-")].filter(Boolean).join(" ");
        return `${sname} ${slot ? `(${slot})` : ""} trùng với ${cname}${cid ? ` (ID ${cid})` : ""}.`;
    });
}
function teacherOverlapText(data) {
    const ov = Array.isArray(data?.conflicts) ? data.conflicts[0] : null;
    if (!ov) return data?.message || "Giáo viên trùng lịch với buổi khác.";
    const tName = ov.teacherName ?? ov.TeacherName ?? "Giáo viên";
    const cName = ov.className ?? ov.ClassName ?? `Lớp #${ov.classId ?? ov.ClassId ?? ""}`;
    const date = ov.date ?? ov.Date ?? "";
    const start = ov.start ?? ov.Start ?? "";
    const end = ov.end ?? ov.End ?? "";
    return `${tName} trùng lịch ở ${cName} — ${date} ${start}-${end}.`;
}
function duplicateSessionText(data) {
    const d = data?.duplicate;
    if (!d) return data?.message || "Buổi học bị trùng trong cùng lớp.";
    const cName = d.className ?? d.ClassName ?? `Lớp #${d.classId ?? d.ClassId ?? ""}`;
    const date = d.date ?? d.Date ?? "";
    const start = d.start ?? d.Start ?? "";
    const end = d.end ?? d.End ?? "";
    return `${cName} đã có buổi ${date} ${start}-${end}.`;
}

export default function EditSessionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles: ctxRoles = [] } = useAuth();
    const isAdmin = ctxRoles.includes("Admin");

    // loading/saving
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // toast lỗi kiểu AddEditSchedulePage
    const AUTO_DISMISS = 5000; // ms
    const [err, setErr] = useState("");
    const [remaining, setRemaining] = useState(0);
    function showError(msg) {
        setErr(msg || "");
        if (msg) setRemaining(AUTO_DISMISS);
    }
    useEffect(() => {
        if (!err) return;
        const startedAt = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - startedAt));
            setRemaining(left);
            if (left === 0) setErr("");
        }, 100); // mượt progress bar (100ms). Nếu muốn nhảy từng giây -> 1000
        return () => clearInterval(iv);
    }, [err]);

    // form state
    const [className, setClassName] = useState("");
    const [sessionDate, setSessionDate] = useState(""); // yyyy-MM-dd
    const [sessionDateText, setSessionDateText] = useState(""); // dd/MM/yyyy
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("09:30");
    const [status, setStatus] = useState(0);
    const [note, setNote] = useState("");
    const [canEdit, setCanEdit] = useState(false);

    // teachers
    const [teachers, setTeachers] = useState([]);
    const [teacherId, setTeacherId] = useState(""); // string cho <select>
    const [teacherName, setTeacherName] = useState("");

    // modal cảnh báo trùng học sinh
    const [warnOpen, setWarnOpen] = useState(false);
    const [warnings, setWarnings] = useState([]);
    const [pendingPayload, setPendingPayload] = useState(null);

    // nạp chi tiết buổi
    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            showError("");
            try {
                const data = await getSession(id);
                if (!alive) return;
                setClassName(data.className ?? `#${data.classId}`);
                setSessionDate(data.sessionDate);
                setSessionDateText(isoToDMY(data.sessionDate));
                setStartTime(HHMM(data.startTime));
                setEndTime(HHMM(data.endTime));
                setStatus(Number(data.status ?? 0));
                setNote(data.note ?? "");
                setCanEdit(!!data.canEdit || isAdmin);

                const curTid = data.teacherId ?? null;
                const curTname = data.teacherName ?? "";
                setTeacherId(curTid == null ? "" : String(curTid));
                setTeacherName(curTname);
            } catch (e) {
                showError(pickErr(e));
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, isAdmin]);

    // nạp GV
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const list = await getTeachers();
                if (!alive) return;
                setTeachers(Array.isArray(list) ? list : []);
                if (!teacherName && teacherId) {
                    const found = list.find((t) => String(t.teacherId ?? t.TeacherId) === String(teacherId));
                    if (found) setTeacherName(found.teacherName ?? found.TeacherName ?? "");
                }
            } catch {
                /* ignore */
            }
        })();
        return () => {
            alive = false;
        };
    }, [teacherId, teacherName]);

    function onChangeTeacher(e) {
        const val = e.target.value;
        setTeacherId(val);
        const found = teachers.find((t) => String(t.teacherId ?? t.TeacherId) === String(val));
        setTeacherName(found ? (found.teacherName ?? found.TeacherName ?? "") : "");
    }

    // ====== SAVE ======
    async function doSave(override = false) {
        setSaving(true);
        showError("");
        try {
            const payload = {
                SessionDate: sessionDate,
                StartTime: startTime,
                EndTime: endTime,
                TeacherId: teacherId === "" ? null : Number(teacherId),
                Status: status,
                Note: note,
                OverrideStudentConflicts: override ? true : undefined,
            };
            await updateSession(id, payload, override ? { override: true } : undefined);
            navigate("/sessions", { state: { notice: "Đã lưu buổi học." } });
        } catch (e) {
            const res = e?.response;
            const code = res?.status;
            const data = res?.data;
            if (code === 409) {
                const errCode = data?.error;

                // xác định có phải trùng học sinh không
                const hasStudentConflicts =
                    Array.isArray(data?.conflicts) &&
                    data.conflicts.some(
                        (c) =>
                            c?.studentId !== undefined ||
                            c?.StudentId !== undefined ||
                            c?.studentName !== undefined ||
                            c?.StudentName !== undefined
                    );

                // -> mở modal khi (đúng) là trùng học sinh
                if (errCode === "StudentOverlapWarning" || hasStudentConflicts) {
                    const warns = conflictsToWarnings(data?.conflicts);
                    setWarnings(warns);
                    setPendingPayload({
                        SessionDate: sessionDate,
                        StartTime: startTime,
                        EndTime: endTime,
                        TeacherId: teacherId === "" ? null : Number(teacherId),
                        Status: status,
                        Note: note,
                    });
                    setWarnOpen(true);
                    setSaving(false);
                    return;
                }

                // TeacherOverlap: hiển thị toast lỗi, KHÔNG mở modal
                if (errCode === "TeacherOverlap") {
                    setWarnOpen(false);
                    setWarnings([]);
                    setPendingPayload(null);
                    showError(teacherOverlapText(data));
                    setSaving(false);
                    return;
                }

                // DuplicateSession: hiển thị toast lỗi, KHÔNG mở modal
                if (errCode === "DuplicateSession") {
                    setWarnOpen(false);
                    setWarnings([]);
                    setPendingPayload(null);
                    showError(duplicateSessionText(data));
                    setSaving(false);
                    return;
                }
            }
            showError(pickErr(e));
            setSaving(false);
        }
    }

    // preflight: check trùng HS trước khi lưu
    async function preflightThenSave() {
        setSaving(true);
        showError("");
        try {
            const patch = {
                sessionDate,
                startTime,
                endTime,
                teacherId: teacherId === "" ? null : Number(teacherId),
            };
            const conflicts = await checkStudentOverlapForSession(id, patch);
            const warns = conflictsToWarnings(conflicts);
            if (warns.length > 0) {
                setWarnings(warns);
                setPendingPayload({
                    SessionDate: sessionDate,
                    StartTime: startTime,
                    EndTime: endTime,
                    TeacherId: teacherId === "" ? null : Number(teacherId),
                    Status: status,
                    Note: note,
                });
                setWarnOpen(true);
                setSaving(false);
                return;
            }
            await doSave(false);
        } catch {
            await doSave(false); // fallback nếu endpoint preflight lỗi
        }
    }

    function onConfirmWarning() {
        setWarnOpen(false);
        doSave(true); // gửi override
    }

    // ====== UI ======
    if (loading) {
        return (
            <>
                <section className="content">
                    <div className="box">
                        <div className="box-body">Đang tải…</div>
                    </div>
                </section>

                {/* Toast lỗi khi đang loading */}
                {err && (
                    <div
                        className="alert alert-danger"
                        style={{
                            position: "fixed",
                            top: 70,
                            right: 16,
                            zIndex: 9999,
                            maxWidth: 420,
                            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                        }}
                    >
                        <button type="button" className="close" onClick={() => showError("")}>
                            <span aria-hidden="true">&times;</span>
                        </button>
                        {err}
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                            Tự ẩn sau {(remaining / 1000).toFixed(1)}s
                        </div>
                        <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                            <div
                                style={{
                                    height: "100%",
                                    width: `${(remaining / AUTO_DISMISS) * 100}%`,
                                    background: "#a94442",
                                    transition: "width 100ms linear",
                                }}
                            />
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>Chỉnh sửa buổi học</h1>
                <small>
                    {className}
                    {teacherName ? ` — ${teacherName}` : ""}
                </small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Thông tin buổi</h3>
                        {!canEdit && (
                            <span className="label label-default" style={{ marginLeft: 10 }}>
                                Chỉ xem (ngoài cửa sổ cho phép sửa)
                            </span>
                        )}
                    </div>

                    <div className="box-body">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!canEdit) return;
                                preflightThenSave();
                            }}
                        >
                            <div className="row">
                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Ngày (dd/MM/yyyy)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="dd/MM/yyyy"
                                            value={sessionDateText}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                                let out = digits;
                                                if (digits.length > 4)
                                                    out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                                else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                                setSessionDateText(out);
                                                const iso = dmyToISO(out);
                                                if (iso) setSessionDate(iso);
                                            }}
                                            onBlur={() => {
                                                const iso = dmyToISO(sessionDateText);
                                                if (iso) setSessionDateText(isoToDMY(iso));
                                            }}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>

                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Bắt đầu</label>
                                        <input
                                            type="time"
                                            className="form-control"
                                            value={startTime}
                                            onChange={(e) => HHMM(e.target.value) && setStartTime(HHMM(e.target.value))}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>

                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Kết thúc</label>
                                        <input
                                            type="time"
                                            className="form-control"
                                            value={endTime}
                                            onChange={(e) => HHMM(e.target.value) && setEndTime(HHMM(e.target.value))}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Giáo viên</label>
                                        <select
                                            className="form-control"
                                            value={teacherId}
                                            onChange={(e) => {
                                                const val = String(e.target.value || "");
                                                const sel = teachers.find(
                                                    (t) => String(t.teacherId ?? t.TeacherId) === val
                                                );
                                                if (sel && (sel.status ?? sel.Status) !== 1) return; // chặn chọn GV ngừng
                                                onChangeTeacher(e);
                                            }}
                                            disabled={!canEdit}
                                        >
                                            <option value="">(Chưa gán)</option>
                                            {teachers.map((t) => {
                                                const idVal = String(t.teacherId ?? t.TeacherId);
                                                const nameVal =
                                                    t.teacherName ?? t.TeacherName ?? t.fullName ?? `GV #${idVal}`;
                                                const isActive = (t.status ?? t.Status ?? (t.isActive ? 1 : 0)) === 1;
                                                return (
                                                    <option
                                                        key={idVal}
                                                        value={idVal}
                                                        disabled={!isActive}
                                                        style={!isActive ? { color: "#999" } : undefined}
                                                        title={!isActive ? "Giáo viên ngừng dạy (không thể chọn)" : undefined}
                                                    >
                                                        {nameVal}{!isActive ? " [Ngừng]" : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <p className="help-block text-muted" style={{ marginBottom: 0 }}>
                                            {teacherName ? `Hiện tại: ${teacherName}` : ""}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Trạng thái</label>
                                        <select
                                            className="form-control"
                                            value={status}
                                            onChange={(e) => setStatus(Number(e.target.value))}
                                            disabled={!canEdit}
                                        >
                                            <option value={0}>Chưa diễn ra</option>
                                            <option value={1}>Hoàn thành</option>
                                            <option value={2}>Hủy</option>
                                            <option value={3}>NoShow</option>
                                            <option value={4}>Dời lịch</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="col-sm-4">
                                    <div className="form-group">
                                        <label>Ghi chú</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => navigate(-1)}
                                    disabled={saving}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ marginLeft: 8 }}
                                    disabled={!canEdit || saving}
                                >
                                    {saving ? "Đang lưu…" : "Lưu"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>

            {/* Toast lỗi nổi (giống AddEditSchedulePage) */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 16,
                        zIndex: 9999,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                    }}
                >
                    <button
                        type="button"
                        className="close"
                        onClick={() => showError("")}
                        aria-label="Close"
                        style={{ marginLeft: 8 }}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>

                    {err}

                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(remaining / 1000).toFixed(1)}s
                    </div>

                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(remaining / AUTO_DISMISS) * 100}%`,
                                background: "#a94442",
                                transition: "width 100ms linear",
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Modal cảnh báo trùng học sinh */}
            <OverlapWarningModal
                open={warnOpen}
                title="Cảnh báo trùng lịch học sinh"
                warnings={warnings}
                onCancel={() => setWarnOpen(false)}
                onConfirm={onConfirmWarning}
            />
        </>
    );
}
