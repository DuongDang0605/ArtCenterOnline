/* eslint-disable no-unused-vars */
// src/Template/Session/EditSessionPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getSession, updateSession, checkStudentOverlapForSession } from "./sessions";
import { getClasses } from "../Class/classes";
import OverlapWarningModal from "../../component/OverlapWarningModal";

// Lấy danh sách giáo viên
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
} catch { /* empty */ }

function pad2(n) { return String(n).padStart(2, "0"); }
function toTimeInput(s) {
    if (!s) return "";
    const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (m) return `${m[1]}:${m[2]}`;
    const d = new Date(`1970-01-01T${s}`);
    if (isNaN(d)) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const toHHMMSS = (t) => `${toTimeInput(t)}:00`;
const anyToISO = (v) => (v || "").slice(0, 10);
const isoToDMY = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
};

export default function EditSessionPage() {
    const { id } = useParams();
    const nav = useNavigate();

    const [info, setInfo] = useState({});
    const [classes, setClasses] = useState([]);

    const [sessionDateISO, setSessionDateISO] = useState("");
    const [sessionDateText, setSessionDateText] = useState("");

    const [startTime, setStartTime] = useState("00:00:00");
    const [endTime, setEndTime] = useState("00:00:00");
    const [teacherId, setTeacherId] = useState("");
    const [status, setStatus] = useState(0);
    const [note, setNote] = useState("");

    const [teachers, setTeachers] = useState([]);

    // ===== Toast lỗi: đếm ngược 5s + progress =====
    const AUTO_DISMISS = 5000;
    const [err, setErr] = useState("");
    const [remaining, setRemaining] = useState(0);
    const showError = (msg) => {
        setErr(msg || "");
        if (msg) setRemaining(AUTO_DISMISS);
    };
    useEffect(() => {
        if (!err) return;
        const startedAt = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - startedAt));
            setRemaining(left);
            if (left === 0) setErr("");
        }, 1000);
        return () => clearInterval(iv);
    }, [err, AUTO_DISMISS]);

    const [saving, setSaving] = useState(false);
    const [warnings, setWarnings] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [one, ts, cls] = await Promise.all([
                    getSession(id),
                    fetchTeachers(),
                    getClasses().catch(() => []),
                ]);
                if (!alive) return;

                setTeachers(Array.isArray(ts) ? ts : []);
                setClasses(Array.isArray(cls) ? cls : []);

                setInfo(one || {});
                const iso = anyToISO(one.sessionDate ?? one.SessionDate);
                setSessionDateISO(iso);
                setSessionDateText(isoToDMY(iso));

                setStartTime(one.startTime ?? one.StartTime ?? "00:00:00");
                setEndTime(one.endTime ?? one.EndTime ?? "00:00:00");
                setTeacherId(one.teacherId ?? one.TeacherId ?? "");
                setStatus(Number(one.status ?? one.Status ?? 0));
                setNote(one.note || "");
            } catch (e) {
                showError(e?.message || "Không tải được buổi học");
            }
        })();
        return () => { alive = false; };
    }, [id]);

    function validate() {
        if (!sessionDateISO) return "Vui lòng chọn ngày.";
        if (teacherId === "" || teacherId == null) return "Vui lòng chọn giáo viên.";
        const s = new Date(`${sessionDateISO}T${toTimeInput(startTime)}:00`);
        const e = new Date(`${sessionDateISO}T${toTimeInput(endTime)}:00`);
        if (!(s < e)) return "Giờ kết thúc phải lớn hơn giờ bắt đầu.";
        return "";
    }

    async function doSave() {
        const payload = {
            SessionDate: sessionDateISO,
            StartTime: toHHMMSS(startTime),
            EndTime: toHHMMSS(endTime),
            TeacherId: teacherId === "" ? null : Number(teacherId),
            Note: note?.trim() || null,
            Status: Number(status ?? 0),
        };
        await updateSession(Number(id), payload);
    }

    async function save() {
        const v = validate();
        if (v) return showError(v);

        try {
            setSaving(true);

            // Warning trùng học sinh (giống schedule)
            const warns = await checkStudentOverlapForSession(Number(id), {
                SessionDate: sessionDateISO,
                StartTime: toHHMMSS(startTime),
                EndTime: toHHMMSS(endTime),
            });
            if (Array.isArray(warns) && warns.length) {
                setWarnings(warns);
                setSaving(false);
                return;
            }

            await doSave();
            nav("/sessions", { state: { notice: "Đã cập nhật buổi học." } });
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

    return (
        <>
            {/* KHÔNG bọc bằng .content-wrapper để tránh khoảng cam */}
            <section className="content-header">
                <h1>Sửa buổi học #{id}</h1>
                <ol className="breadcrumb">
                    <li><Link to="/">Trang chủ</Link></li>
                    <li className="active">Sửa buổi</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Thông tin buổi</h3>
                    </div>

                    <div className="box-body">
                        <div className="row">
                            <div className="col-sm-3">
                                <div className="form-group">
                                    <label>Ngày</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={sessionDateISO}
                                        onChange={(e) => {
                                            const iso = e.target.value;
                                            setSessionDateISO(iso);
                                            setSessionDateText(isoToDMY(iso));
                                            if (err) showError("");
                                        }}
                                    />
                                    <p className="help-block">Dạng: {sessionDateText || "dd/MM/yyyy"}</p>
                                </div>
                            </div>
                            <div className="col-sm-2">
                                <div className="form-group">
                                    <label>Bắt đầu</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={toTimeInput(startTime)}
                                        onChange={(e) => { setStartTime(e.target.value); if (err) showError(""); }}
                                    />
                                </div>
                            </div>
                            <div className="col-sm-2">
                                <div className="form-group">
                                    <label>Kết thúc</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={toTimeInput(endTime)}
                                        onChange={(e) => { setEndTime(e.target.value); if (err) showError(""); }}
                                    />
                                </div>
                            </div>
                            <div className="col-sm-5">
                                <div className="form-group">
                                    <label>Giáo viên</label>
                                    <select
                                        className="form-control"
                                        value={teacherId}
                                        onChange={(e) => { setTeacherId(e.target.value); if (err) showError(""); }}
                                    >
                                        <option value="">-- Chọn giáo viên --</option>
                                        {teachers.map((t) => {
                                            const idv = t.teacherId ?? t.TeacherId;
                                            const name = t.teacherName ?? t.fullName ?? t.FullName ?? `(GV #${idv})`;
                                            return <option key={idv} value={idv}>{name}</option>;
                                        })}
                                    </select>
                                    <p className="help-block">
                                        GV hiện tại:{" "}
                                        <b>
                                            {info.teacherName ??
                                                info.teacherFullName ??
                                                info.teacher?.fullName ??
                                                (info.teacherId != null ? `#${info.teacherId}` : "—")}
                                        </b>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Ghi chú</label>
                            <input className="form-control" value={note} onChange={(e) => { setNote(e.target.value); if (err) showError(""); }} />
                        </div>
                    </div>

                    <div className="box-footer">
                        <button className="btn btn-primary" disabled={saving} onClick={save}>
                            <i className="fa fa-save" /> Lưu
                        </button>
                        <Link to="/sessions" className="btn btn-default" style={{ marginLeft: 10 }}>
                            Hủy
                        </Link>
                    </div>
                </div>
            </section>

            {/* Toast lỗi nổi (đếm ngược + progress) */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => showError("")} aria-label="Close" style={{ marginLeft: 8 }}>
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
                                transition: "width 100ms linear"
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Modal cảnh báo học sinh trùng */}
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
                            await doSave();
                            nav("/sessions", { state: { notice: "Đã cập nhật buổi học." } });
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
