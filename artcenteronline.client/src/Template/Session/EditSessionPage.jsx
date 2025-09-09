// src/Template/Session/EditSessionPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession, updateSession, checkStudentOverlapForSession } from "./sessions";
import { getTeachers } from "../Teacher/teachers"; // <-- lấy danh sách giáo viên theo tên
import { useAuth } from "../../auth/authCore";
import OverlapWarningModal from "../../component/OverlapWarningModal";

function pickErr(e) {
    return (
        e?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.statusText ||
        "Đã có lỗi xảy ra."
    );
}

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

/** Convert BE conflicts (object[]) -> string[] for OverlapWarningModal */
function conflictsToWarnings(conflicts) {
    if (!Array.isArray(conflicts)) return [];
    return conflicts.map((it) => {
        const sid = it.studentId ?? it.StudentId ?? "";
        const sname = it.studentName ?? it.StudentName ?? (sid ? `HS #${sid}` : "Học sinh");
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

export default function EditSessionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles: ctxRoles = [] } = useAuth();
    // eslint-disable-next-line no-unused-vars
    const isAdmin = ctxRoles.includes("Admin");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // form state
    const [className, setClassName] = useState("");
    const [sessionDate, setSessionDate] = useState(""); // yyyy-MM-dd
    const [sessionDateText, setSessionDateText] = useState(""); // dd/MM/yyyy
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("09:30");
    const [status, setStatus] = useState(0);
    const [note, setNote] = useState("");
    const [canEdit, setCanEdit] = useState(false);

    // teacher (theo tên)
    const [teachers, setTeachers] = useState([]);
    const [teacherId, setTeacherId] = useState(""); // dùng string cho <select>
    const [teacherName, setTeacherName] = useState("");

    // warning modal state
    const [warnOpen, setWarnOpen] = useState(false);
    const [warnings, setWarnings] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [pendingPayload, setPendingPayload] = useState(null);

    // nạp chi tiết buổi
    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setErr("");
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
                setCanEdit(!!data.canEdit);

                // teacher hiện tại
                const curTid = data.teacherId ?? null;
                const curTname = data.teacherName ?? "";
                setTeacherId(curTid == null ? "" : String(curTid));
                setTeacherName(curTname);
            } catch (e) {
                setErr(pickErr(e));
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id]);

    // nạp danh sách giáo viên để chọn theo tên
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const list = await getTeachers(); // mong đợi trả mảng { teacherId, teacherName }
                if (!alive) return;
                setTeachers(Array.isArray(list) ? list : []);
                // nếu tên trống nhưng có id, cố gắng map tên từ list
                if (!teacherName && teacherId) {
                    const found = list.find(
                        (t) => String(t.teacherId ?? t.TeacherId) === String(teacherId)
                    );
                    if (found) setTeacherName(found.teacherName ?? found.TeacherName ?? "");
                }
            } catch {
                // im lặng: nếu lỗi vẫn cho phép giữ id hiện tại
            }
        })();
        return () => {
            alive = false;
        };
    }, [teacherId]); // khi teacherId thay đổi mà chưa có tên -> map tên

    function onChangeTeacher(e) {
        const val = e.target.value; // "" hoặc id dạng string
        setTeacherId(val);
        const found = teachers.find((t) => String(t.teacherId ?? t.TeacherId) === String(val));
        setTeacherName(found ? (found.teacherName ?? found.TeacherName ?? "") : "");
    }

    async function doSave(override = false) {
        setSaving(true);
        setErr("");
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
            await updateSession(id, payload);
            navigate("/sessions", { state: { notice: "Đã lưu buổi học." } });
        } catch (e) {
            const res = e?.response;
            const code = res?.status;
            const msg = pickErr(e);

            if (code === 409 && (res?.data?.error === "StudentOverlapWarning" || Array.isArray(res?.data?.conflicts))) {
                const warns = conflictsToWarnings(res?.data?.conflicts);
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

            setErr(msg);
            setSaving(false);
        }
    }

    async function preflightThenSave() {
        setSaving(true);
        setErr("");
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
            await doSave(false); // fallback
        }
    }

    function onConfirmWarning() {
        setWarnOpen(false);
        doSave(true);
    }
    // (đặt 2 biến này trước phần return của component)
    const selectedTeacherObj = teachers.find(
        (t) => String(t.teacherId ?? t.TeacherId) === String(teacherId || "")
    );
    // eslint-disable-next-line no-unused-vars
    const selectedStatusText = selectedTeacherObj
        ? ((selectedTeacherObj.status ?? selectedTeacherObj.Status) === 1 ? "Đang dạy" : "Ngừng")
        : "";

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
                        {err && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{String(err)}</div>}

                        {loading ? (
                            <div className="text-muted">Đang tải…</div>
                        ) : (
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
                                                    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
                                                onChange={(e) => setStartTime(HHMM(e.target.value))}
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
                                                onChange={(e) => setEndTime(HHMM(e.target.value))}
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
                                                        const sel = teachers.find(t => String(t.teacherId ?? t.TeacherId) === val);
                                                        if (sel && (sel.status ?? sel.Status) !== 1) return; // chặn chọn giáo viên ngừng
                                                        onChangeTeacher(e);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    <option value="">(Chưa gán)</option>
                                                    {teachers.map((t) => {
                                                        const idVal = String(t.teacherId ?? t.TeacherId);
                                                        const nameVal = t.teacherName ?? t.TeacherName ?? `GV #${idVal}`;
                                                        const isActive = (t.status ?? t.Status) === 1;
                                                        return (
                                                            <option
                                                                key={idVal}
                                                                value={idVal}
                                                                disabled={!isActive}                             // chặn chọn
                                                                style={!isActive ? { color: "#999" } : undefined}
                                                                title={!isActive ? "Giáo viên ngừng dạy (không thể chọn)" : undefined}
                                                            >
                                                                {nameVal}
                                                            </option>
                                                        );
                                                    })}
                                                </select>

                                                <p className="help-block text-muted" style={{ marginBottom: 0 }}>
                                                    {teacherName ? `Hiện tại: ${teacherName} ` : ""}
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
                                    <button type="button" className="btn btn-default" onClick={() => navigate(-1)} disabled={saving}>
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ marginLeft: 8 }} disabled={!canEdit || saving}>
                                        {saving ? "Đang lưu…" : "Lưu"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            <OverlapWarningModal
                open={warnOpen}
                warnings={warnings}
                onCancel={() => setWarnOpen(false)}
                onConfirm={onConfirmWarning}
                title="Cảnh báo trùng lịch học sinh"
            />
        </>
    );
}
