// src/Template/Session/EditSessionPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getSession, updateSession } from "./sessions";
import { getClasses } from "../Class/classes";

// Chuẩn bị hàm lấy danh sách giáo viên (không dùng top‑level await)
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

function toDateValue(yyyyMMdd) { return yyyyMMdd; } // server đã trả "yyyy-MM-dd"

export default function EditSessionPage() {
    const { id } = useParams();                 // /sessions/:id/edit
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [info, setInfo] = useState(null);     // dữ liệu gốc
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);

    // form state
    const [sessionDate, setSessionDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [teacherId, setTeacherId] = useState(""); // "" => fallback main teacher
    const [status, setStatus] = useState(0);        // 0 Planned, 1 Completed, 2 Cancelled, 3 NoShow, 4 Rescheduled
    const [note, setNote] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true); setErr("");

                const [one, cls, ts] = await Promise.all([
                    getSession(id),
                    getClasses(),
                    fetchTeachers()
                ]);
                if (!alive) return;

                setInfo(one);
                setClasses(Array.isArray(cls) ? cls : []);
                setTeachers(Array.isArray(ts) ? ts : []);

                setSessionDate(toDateValue(one.sessionDate));
                setStartTime(one.startTime);
                setEndTime(one.endTime);
                setTeacherId(one.teacherId ?? "");  // null => ""
                setStatus(Number(one.status ?? 0));
                setNote(one.note || "");
            } catch (e) {
                if (!alive) return;
                setErr(e?.message || "Không tải được buổi học");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id]);

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");

        if (!info?.canEdit) {
            setErr("Buổi học đã/đang diễn ra, không thể chỉnh sửa.");
            return;
        }
        if (!sessionDate || !startTime || !endTime) {
            setErr("Vui lòng nhập đầy đủ ngày/giờ.");
            return;
        }
        if (endTime <= startTime) {
            setErr("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
            return;
        }

        try {
            const patch = {
                SessionDate: sessionDate,       // "yyyy-MM-dd"
                StartTime: startTime,           // "HH:mm"
                EndTime: endTime,               // "HH:mm"
                TeacherId: teacherId === "" ? null : Number(teacherId),
                Note: note || null,
                Status: Number(status),         // ✅ gửi trạng thái lên server
            };
            await updateSession(Number(id), patch);
            alert("Cập nhật buổi học thành công.");
            navigate("/sessions");
        } catch (e) {
            setErr(e?.message || "Cập nhật thất bại");
        }
    }

    if (loading) {
        return (
            <>
                <section className="content-header"><h1>Sửa buổi học</h1></section>
                <section className="content"><p className="text-muted">Đang tải…</p></section>
            </>
        );
    }
    if (!info) {
        return (
            <>
                <section className="content-header"><h1>Sửa buổi học</h1></section>
                <section className="content"><div className="alert alert-danger">{err || "Không tìm thấy buổi học"}</div></section>
            </>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>Sửa buổi học</h1>
                <small>{info.className} — #{info.sessionId}</small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <Link to="/sessions" className="btn btn-default btn-sm">
                            <i className="fa fa-arrow-left" /> Quay lại
                        </Link>
                    </div>

                    {err && <div className="box-body"><div className="alert alert-danger">{err}</div></div>}

                    <form className="form-horizontal" onSubmit={onSubmit}>
                        <div className="box-body">
                            {!info.canEdit && (
                                <div className="alert alert-warning">
                                    Buổi học đã bắt đầu/đã diễn ra nên <b>không thể chỉnh sửa</b>.
                                </div>
                            )}

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Lớp</label>
                                <div className="col-sm-10">
                                    <p className="form-control-static">{info.className} (ID: {info.classID})</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Ngày</label>
                                <div className="col-sm-4">
                                    <input type="date" className="form-control" value={sessionDate} onChange={e => setSessionDate(e.target.value)} disabled={!info.canEdit} />
                                </div>

                                <label className="col-sm-2 control-label">Giờ bắt đầu</label>
                                <div className="col-sm-4">
                                    <input type="time" className="form-control" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={!info.canEdit} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Giờ kết thúc</label>
                                <div className="col-sm-4">
                                    <input type="time" className="form-control" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!info.canEdit} />
                                </div>

                                <label className="col-sm-2 control-label">Giáo viên</label>
                                <div className="col-sm-4">
                                    <select className="form-control" value={teacherId} onChange={e => setTeacherId(e.target.value)} disabled={!info.canEdit}>
                                        <option value="">(Dùng GV chính của lớp)</option>
                                        {teachers.map(t => (
                                            <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                                        ))}
                                    </select>
                                    <p className="help-block">
                                        GV hiện tại: <b>{info.teacherName || "— (fallback GV chính)"}</b>
                                    </p>
                                </div>
                            </div>

                            {/* ✅ Trạng thái */}
                            <div className="form-group">
                                <label className="col-sm-2 control-label">Trạng thái</label>
                                <div className="col-sm-4">
                                    <select
                                        className="form-control"
                                        value={status}
                                        onChange={e => setStatus(Number(e.target.value))}
                                        disabled={!info.canEdit}
                                    >
                                        <option value={0}>Planned</option>
                                        <option value={1}>Completed</option>
                                        <option value={2}>Cancelled</option>
                                        <option value={3}>NoShow</option>
                                        <option value={4}>Rescheduled</option>
                                    </select>
                                    <p className="help-block">
                                        Chỉ có thể hủy khi buổi <b>chưa diễn ra</b>.
                                    </p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Ghi chú</label>
                                <div className="col-sm-10">
                                    <textarea className="form-control" rows="2" value={note} onChange={e => setNote(e.target.value)} disabled={!info.canEdit} />
                                </div>
                            </div>
                        </div>

                        <div className="box-footer">
                            <button type="button" className="btn btn-default" onClick={() => navigate("/sessions")}>
                                Hủy
                            </button>
                            <button type="submit" className="btn btn-primary pull-right" disabled={!info.canEdit}>
                                Lưu thay đổi
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}
