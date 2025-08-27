import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAllSessions } from "./sessions";
import { getClasses } from "../Class/classes";
import { useAuth } from "../../auth/authCore"; // <-- sửa đường dẫn

function firstLastOfCurrentMonth() {
    const now = new Date();
    return {
        first: new Date(now.getFullYear(), now.getMonth(), 1),
        last: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
}
function d2input(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function statusBadge(s) {
    const map = {
        0: { text: "Planned", cls: "label-default" },
        1: { text: "Completed", cls: "label-success" },
        2: { text: "Cancelled", cls: "label-danger" },
        3: { text: "NoShow", cls: "label-warning" },
        4: { text: "Rescheduled", cls: "label-info" },
    };
    return map[s] || { text: s, cls: "label-default" };
}
function canEdit(sessionDate, startTime) {
    const [y, m, d] = sessionDate.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    const start = new Date(y, m - 1, d, hh, mm, 0);
    return Date.now() < start.getTime();
}

export default function SessionsPage() {
    const navigate = useNavigate();
    const auth = useAuth();

    const isTeacher = Array.isArray(auth?.roles) && auth.roles.includes("Teacher");
    const myTeacherId =
        auth?.user?.teacherId ??
        auth?.user?.TeacherId ??
        auth?.user?.teacher?.teacherId ??
        auth?.user?.teacher?.TeacherId ??
        "";

    const today = new Date();
    const todayStr = d2input(today);
    const { first, last } = firstLastOfCurrentMonth();

    const [from, setFrom] = useState(isTeacher ? todayStr : d2input(first));
    const [to, setTo] = useState(isTeacher ? todayStr : d2input(last));
    const [classId, setClassId] = useState("");
    const [teacherId, setTeacherId] = useState(isTeacher ? String(myTeacherId || "") : "");
    const [status, setStatus] = useState("");

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [rows, setRows] = useState([]);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // Ép filter khi là Teacher
    useEffect(() => {
        if (isTeacher) {
            if (from !== todayStr) setFrom(todayStr);
            if (to !== todayStr) setTo(todayStr);
            if (String(teacherId || "") !== String(myTeacherId || "")) {
                setTeacherId(String(myTeacherId || ""));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId, todayStr]);

    // load dropdown options
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const clsPromise = getClasses();
                const teachersPromise = (async () => {
                    try {
                        const mod = await import("../Teacher/teachers");
                        return typeof mod.getTeachers === "function" ? mod.getTeachers() : [];
                    } catch {
                        return [];
                    }
                })();

                const [cls, ts] = await Promise.all([clsPromise, teachersPromise]);
                if (!alive) return;
                setClasses(Array.isArray(cls) ? cls : []);
                setTeachers(Array.isArray(ts) ? ts : []);
            } catch (e) {
                if (!alive) return;
                setErr(e?.message || "Load options failed");
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    async function fetchData() {
        setLoading(true);
        setErr("");
        try {
            const effectiveTeacherId = isTeacher
                ? (myTeacherId ? Number(myTeacherId) : undefined)
                : (teacherId ? Number(teacherId) : undefined);
            const effectiveFrom = isTeacher ? new Date(todayStr) : new Date(from);
            const effectiveTo = isTeacher ? new Date(todayStr) : new Date(to);

            const data = await listAllSessions({
                from: effectiveFrom,
                to: effectiveTo,
                classId: classId ? Number(classId) : undefined,
                teacherId: effectiveTeacherId,
                status: status === "" ? undefined : Number(status),
            });
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setErr(e?.message || "Load sessions failed");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }

    // initial + khi myTeacherId sẵn sàng
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId]);

    const header = useMemo(
        () => [
            { key: "date", title: "Ngày", width: 110 },
            { key: "time", title: "Thời gian", width: 120 },
            { key: "class", title: "Lớp" },
            { key: "teacher", title: "Giáo viên", width: 200 },
            { key: "status", title: "Trạng thái", width: 120 },
            { key: "auto", title: "Tự sinh", width: 70 },
            { key: "note", title: "Ghi chú" },
            { key: "actions", title: "Thao tác", width: 180 },
        ],
        []
    );

    function setThisMonth() {
        const { first, last } = firstLastOfCurrentMonth();
        setFrom(d2input(first));
        setTo(d2input(last));
    }

    return (
        <>
            <section className="content-header">
                <h1>Tất cả buổi học</h1>
                <small>
                    {isTeacher
                        ? "Giáo viên: chỉ xem các buổi dạy của bạn trong ngày hôm nay"
                        : "Xem/lọc toàn bộ buổi học theo khoảng ngày"}
                </small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <form
                            className="form-inline"
                            onSubmit={(e) => {
                                e.preventDefault();
                                fetchData();
                            }}
                        >
                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Từ</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={isTeacher ? todayStr : from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    disabled={isTeacher}
                                />
                            </div>
                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Đến</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={isTeacher ? todayStr : to}
                                    onChange={(e) => setTo(e.target.value)}
                                    disabled={isTeacher}
                                />
                            </div>

                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Lớp</label>
                                <select className="form-control" value={classId} onChange={(e) => setClassId(e.target.value)}>
                                    <option value="">(Tất cả)</option>
                                    {classes.map((c) => (
                                        <option key={c.classID} value={c.classID}>
                                            {c.className}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Ẩn chọn giáo viên nếu role Teacher */}
                            {!isTeacher && (
                                <div className="form-group" style={{ marginRight: 10 }}>
                                    <label style={{ marginRight: 6 }}>Giáo viên</label>
                                    <select className="form-control" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                                        <option value="">(Tất cả)</option>
                                        {teachers.map((t) => (
                                            <option key={t.teacherId} value={t.teacherId}>
                                                {t.teacherName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Trạng thái</label>
                                <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                                    <option value="">(Tất cả)</option>
                                    <option value="0">Planned</option>
                                    <option value="1">Completed</option>
                                    <option value="2">Cancelled</option>
                                    <option value="3">NoShow</option>
                                    <option value="4">Rescheduled</option>
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }} disabled={loading}>
                                {loading ? "Đang tải..." : "Lọc"}
                            </button>

                            {!isTeacher && (
                                <button type="button" className="btn btn-default" onClick={setThisMonth}>
                                    Tháng này
                                </button>
                            )}
                        </form>
                    </div>

                    {err && (
                        <div className="box-body">
                            <div className="alert alert-danger">{err}</div>
                        </div>
                    )}

                    <div className="box-body">
                        <div style={{ marginBottom: 8, color: "#555" }}>
                            Kết quả: <b>{rows.length}</b> buổi
                        </div>

                        <div className="table-responsive">
                            <table className="table table-bordered table-hover" style={{ width: "100%" }}>
                                <thead>
                                    <tr>
                                        {header.map((h) => (
                                            <th key={h.key} style={h.width ? { width: h.width } : undefined}>
                                                {h.title}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={header.length} className="text-center text-muted">
                                                Không có dữ liệu
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((r) => {
                                        const st = statusBadge(r.status);
                                        const editable = canEdit(r.sessionDate, r.startTime);
                                        return (
                                            <tr key={r.sessionId}>
                                                <td>{r.sessionDate}</td>
                                                <td>
                                                    {r.startTime}–{r.endTime}
                                                </td>
                                                <td>{r.className}</td>
                                                <td>{r.teacherName || <span className="text-muted">—</span>}</td>
                                                <td>
                                                    <span className={`label ${st.cls}`}>{st.text}</span>
                                                </td>
                                                <td>{r.isAutoGenerated ? "✓" : ""}</td>
                                                <td>{r.note || <span className="text-muted">—</span>}</td>
                                                <td>
                                                    <div className="btn-group btn-group-xs">
                                                        {/* Admin/khác Teacher: có Edit/Xem, KHÔNG có điểm danh */}
                                                        {!isTeacher &&
                                                            (editable ? (
                                                                <button
                                                                    className="btn btn-primary"
                                                                    onClick={() => navigate(`/sessions/${r.sessionId}/edit`)}
                                                                >
                                                                    <i className="fa fa-edit" /> Sửa
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="btn btn-default"
                                                                    onClick={() => navigate(`/sessions/${r.sessionId}/edit`)}
                                                                    title="Hết hạn sửa (đã qua giờ bắt đầu)"
                                                                >
                                                                    <i className="fa fa-lock" /> Xem
                                                                </button>
                                                            ))}

                                                        {/* Teacher: CHỈ có Điểm danh */}
                                                        {isTeacher && (
                                                            <button
                                                                className="btn btn-success"
                                                                onClick={() => navigate(`/sessions/${r.sessionId}/attendance`)}
                                                                title="Điểm danh"
                                                            >
                                                                <i className="fa fa-check-square-o" /> Điểm danh
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
