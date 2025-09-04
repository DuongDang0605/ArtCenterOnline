// src/Template/Session/SessionsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listAllSessions } from "./sessions";
import { getClasses } from "../Class/classes";
import { useAuth } from "../../auth/authCore";

function firstLastOfCurrentMonth() {
    const now = new Date();
    return {
        first: new Date(now.getFullYear(), now.getMonth(), 1),
        last: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
}
function d2input(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
}

// ===== Helpers dd/MM/yyyy <-> yyyy-MM-dd =====
const pad2 = (n) => String(n).padStart(2, "0");
function dmyToISO(dmy) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy || "");
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
}
function isoToDMY(iso) {
    if (!iso) return "";
    const [y, mo, d] = String(iso).split("-");
    return `${d}/${mo}/${y}`;
}
// Chuẩn hoá mọi kiểu (yyyy-MM-dd hoặc yyyy-MM-ddTHH:mm:ss) về yyyy-MM-dd
function anyToISO(v) {
    if (!v) return "";
    const s = String(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function statusBadge(s) {
    const map = {
        0: { text: "Chưa diễn ra", cls: "label-default" },
        1: { text: "Hoàn thành", cls: "label-success" },
        2: { text: "Bị hủy", cls: "label-danger" },
        3: { text: "Ẩn", cls: "label-warning" },
        4: { text: "Học bù", cls: "label-info" },
    };
    return map[s] || { text: s, cls: "label-default" };
}
function canEdit(sessionDate, startTime) {
    const [y, m, d] = anyToISO(sessionDate).split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    const start = new Date(y, m - 1, d, hh, mm, 0);
    return Date.now() < start.getTime();
}

// Ưu tiên thông điệp có ích từ Axios error
function pickErr(e) {
    const res = e?.response;
    return (
        e?.userMessage ||
        res?.data?.message ||
        res?.data?.detail ||
        res?.data?.title ||
        (typeof res?.data === "string" ? res.data : null) ||
        e?.message ||
        "Có lỗi xảy ra."
    );
}

export default function SessionsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();

    const isAdmin = Array.isArray(auth?.roles) && auth.roles.includes("Admin");
    const isTeacher = Array.isArray(auth?.roles) && auth.roles.includes("Teacher");
    const myTeacherId =
        auth?.user?.teacherId ??
        auth?.user?.TeacherId ??
        auth?.user?.teacher?.teacherId ??
        auth?.user?.teacher?.TeacherId ??
        "";

    const today = new Date();
    const todayISO = d2input(today);
    const { first, last } = firstLastOfCurrentMonth();

    // --- Bộ lọc ngày: ISO để gọi API, Text để hiển thị dd/MM/yyyy
    const [fromISO, setFromISO] = useState(isTeacher ? todayISO : d2input(first));
    const [toISO, setToISO] = useState(isTeacher ? todayISO : d2input(last));
    const [fromText, setFromText] = useState(isoToDMY(isTeacher ? todayISO : d2input(first)));
    const [toText, setToText] = useState(isoToDMY(isTeacher ? todayISO : d2input(last)));

    const [classId, setClassId] = useState("");
    const [teacherId, setTeacherId] = useState(isTeacher ? String(myTeacherId || "") : "");
    const [status, setStatus] = useState("");

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [rows, setRows] = useState([]);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [flash, setFlash] = useState("");

    // Nhận flash success từ trang trước (EditSessionPage → navigate(..., { state: { flash } }))
    useEffect(() => {
        const f = location?.state?.flash;
        if (f) {
            setFlash(String(f));
            // Xóa state để F5 không hiện lại
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Ép filter khi là Teacher: luôn hôm nay + (mặc định) buổi của chính mình
    useEffect(() => {
        if (isTeacher) {
            if (fromISO !== todayISO) {
                setFromISO(todayISO);
                setFromText(isoToDMY(todayISO));
            }
            if (toISO !== todayISO) {
                setToISO(todayISO);
                setToText(isoToDMY(todayISO));
            }
            if (String(teacherId || "") !== String(myTeacherId || "")) {
                setTeacherId(String(myTeacherId || ""));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId, todayISO]);

    // load dropdown options (lớp & giáo viên)
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
                setErr(pickErr(e));
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
                ? myTeacherId
                    ? Number(myTeacherId)
                    : undefined
                : teacherId
                    ? Number(teacherId)
                    : undefined;

            const effectiveFrom = isTeacher ? new Date(todayISO) : new Date(fromISO);
            const effectiveTo = isTeacher ? new Date(todayISO) : new Date(toISO);

            const data = await listAllSessions({
                from: effectiveFrom,
                to: effectiveTo,
                classId: classId ? Number(classId) : undefined,
                teacherId: effectiveTeacherId,
                status: status === "" ? undefined : Number(status),
            });
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setErr(pickErr(e));
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

    // eslint-disable-next-line no-unused-vars
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
        const fISO = d2input(first);
        const tISO = d2input(last);
        setFromISO(fISO);
        setToISO(tISO);
        setFromText(isoToDMY(fISO));
        setToText(isoToDMY(tISO));
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
                                    type="text"
                                    className="form-control"
                                    placeholder="dd/mm/yyyy"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={fromText}
                                    onChange={(e) => {
                                        if (isTeacher) return; // bị khoá
                                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        let out = digits;
                                        if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        setFromText(out);
                                        const iso = dmyToISO(out);
                                        setFromISO(iso ?? "");
                                    }}
                                    onBlur={() => {
                                        const iso = dmyToISO(fromText);
                                        if (iso) setFromText(isoToDMY(iso));
                                    }}
                                    disabled={isTeacher}
                                />
                            </div>
                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Đến</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="dd/mm/yyyy"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={toText}
                                    onChange={(e) => {
                                        if (isTeacher) return; // bị khoá
                                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        let out = digits;
                                        if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        setToText(out);
                                        const iso = dmyToISO(out);
                                        setToISO(iso ?? "");
                                    }}
                                    onBlur={() => {
                                        const iso = dmyToISO(toText);
                                        if (iso) setToText(isoToDMY(iso));
                                    }}
                                    disabled={isTeacher}
                                />
                            </div>

                            <div className="form-group" style={{ marginRight: 10 }}>
                                <label style={{ marginRight: 6 }}>Lớp</label>
                                <select
                                    className="form-control"
                                    value={classId}
                                    onChange={(e) => setClassId(e.target.value)}
                                >
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
                                    <select
                                        className="form-control"
                                        value={teacherId}
                                        onChange={(e) => setTeacherId(e.target.value)}
                                    >
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
                                <select
                                    className="form-control"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="">(Tất cả)</option>
                                    <option value="0">Chưa diễn ra</option>
                                    <option value="1">Hoàn thành</option>
                                    <option value="2">Bị hủy</option>
                                    <option value="3">Ẩn</option>
                                    <option value="4">Học bù</option>
                                </select>
                            </div>

                            {/* Nút hành động – hạ xuống một chút để thẳng hàng với input */}
                            <div className="form-group" style={{ marginTop: 6 }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ marginRight: 8 }}
                                    disabled={loading}
                                >
                                    {loading ? "Đang tải..." : "Lọc"}
                                </button>

                                {!isTeacher && (
                                    <button
                                        type="button"
                                        className="btn btn-default"
                                        onClick={setThisMonth}
                                    >
                                        Tháng này
                                    </button>
                                )}
                            </div>

                        </form>
                    </div>

                    {/* Banner success khi điều hướng về */}
                    {flash && (
                        <div
                            className="box-body"
                            style={{ paddingTop: 0, paddingBottom: 0, marginTop: 10 }}
                        >
                            <div
                                className="alert alert-success alert-dismissible"
                                role="alert"
                                style={{ fontSize: 16, fontWeight: "bold" }}
                            >
                                <button
                                    type="button"
                                    className="close"
                                    aria-label="Close"
                                    onClick={() => setFlash("")}
                                    style={{ fontSize: 20 }}
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                                <i className="fa fa-check-circle" style={{ marginRight: 6 }} />
                                {flash}
                            </div>
                        </div>
                    )}

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
                            <table
                                className="table table-bordered table-hover"
                                style={{ width: "100%" }}
                            >
                                <thead>
                                    <tr>
                                        {[
                                            { key: "date", title: "Ngày", width: 110 },
                                            { key: "time", title: "Thời gian", width: 120 },
                                            { key: "class", title: "Lớp" },
                                            { key: "teacher", title: "Giáo viên", width: 200 },
                                            { key: "status", title: "Trạng thái", width: 120 },
                                            { key: "auto", title: "Tự sinh", width: 70 },
                                            { key: "note", title: "Ghi chú" },
                                            { key: "actions", title: "Thao tác", width: 180 },
                                        ].map((h) => (
                                            <th
                                                key={h.key}
                                                style={h.width ? { width: h.width } : undefined}
                                            >
                                                {h.title}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center text-muted">
                                                Không có dữ liệu
                                            </td>
                                        </tr>
                                    )}

                                    {rows.map((r) => {
                                        const st = statusBadge(r.status);
                                        const editable = canEdit(r.sessionDate, r.startTime);
                                        return (
                                            <tr key={r.sessionId}>
                                                <td>{isoToDMY(anyToISO(r.sessionDate))}</td>
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
                                                        {isAdmin ? (
                                                            <>
                                                                {editable ? (
                                                                    <button
                                                                        className="btn btn-primary"
                                                                        onClick={() =>
                                                                            navigate(`/sessions/${r.sessionId}/edit`)
                                                                        }
                                                                    >
                                                                        <i className="fa fa-edit" /> Sửa
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className="btn btn-default"
                                                                        onClick={() =>
                                                                            navigate(`/sessions/${r.sessionId}/edit`)
                                                                        }
                                                                        title="Hết hạn sửa (đã qua giờ bắt đầu)"
                                                                    >
                                                                        <i className="fa fa-lock" /> Xem
                                                                    </button>
                                                                )}

                                                                <button
                                                                    className="btn btn-success"
                                                                    onClick={() =>
                                                                        navigate(`/sessions/${r.sessionId}/attendance`)
                                                                    }
                                                                    title="Điểm danh"
                                                                >
                                                                    <i className="fa fa-check-square-o" /> Điểm danh
                                                                </button>
                                                            </>
                                                        ) : isTeacher ? (
                                                            <button
                                                                className="btn btn-success"
                                                                onClick={() =>
                                                                    navigate(`/sessions/${r.sessionId}/attendance`)
                                                                }
                                                                title="Điểm danh"
                                                            >
                                                                <i className="fa fa-check-square-o" /> Điểm danh
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="btn btn-default"
                                                                onClick={() =>
                                                                    navigate(`/sessions/${r.sessionId}/edit`)
                                                                }
                                                                title="Chỉ được xem"
                                                            >
                                                                <i className="fa fa-eye" /> Xem
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

                        {/* Nút load lại */}
                        <div style={{ marginTop: 10 }}>
                            <button
                                className="btn btn-default btn-sm"
                                onClick={fetchData}
                                disabled={loading}
                            >
                                <i className="fa fa-refresh" /> Tải lại
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
