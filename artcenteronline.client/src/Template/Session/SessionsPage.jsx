// src/Template/Session/SessionsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { listAllSessions } from "./sessions";
import { getClasses } from "../Class/classes";
import { useAuth } from "../../auth/authCore";

function firstLastOfCurrentMonth() {
    const now = new Date();
    return { first: new Date(now.getFullYear(), now.getMonth(), 1), last: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
}
function d2input(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function isoToDMY(iso) { if (!iso) return ""; const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; }
function dmyToISO(dmy) { if (!dmy) return ""; const parts = dmy.split("/"); if (parts.length !== 3) return ""; const [d, m, y] = parts; return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
function anyToISO(x) { if (!x) return ""; if (x instanceof Date) return d2input(x); if (typeof x === "string" && x.includes("-")) return x.slice(0, 10); return ""; }
function pickErr(e) { return (e?.message || e?.response?.data?.message || e?.response?.data?.error || e?.response?.statusText || "Lỗi không xác định"); }
function statusBadge(s) {
    const map = { 0: { text: "Chưa diễn ra", cls: "label-default" }, 1: { text: "Hoàn thành", cls: "label-success" }, 2: { text: "Hủy", cls: "label-danger" }, 3: { text: "NoShow", cls: "label-warning" }, 4: { text: "Dời lịch", cls: "label-info" } };
    return map[s] || { text: String(s), cls: "label-default" };
}
function canEditISOTime(dateIso, hhmm) {
    if (!dateIso || !hhmm) return false;
    try { const [y, m, d] = dateIso.split("-").map(Number); const [hh, mm] = String(hhmm).split(":").map((x) => parseInt(x, 10) || 0); const start = new Date(y, m - 1, d, hh, mm, 0); return Date.now() < start.getTime(); }
    catch { return false; }
}

export default function SessionsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();

    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");
    const myTeacherId =
        auth?.user?.teacherId ?? auth?.user?.TeacherId ?? auth?.user?.teacher?.teacherId ?? auth?.user?.teacher?.TeacherId ?? "";

    const today = new Date();
    const todayISO = d2input(today);
    const { first, last } = firstLastOfCurrentMonth();

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

    // Toast success khi quay về từ Edit
    const [notice, setNotice] = useState(location.state?.notice || "");
    useEffect(() => {
        if (location.state?.notice) {
            // xoá state trên URL sau khi đọc
            setTimeout(() => { navigate(".", { replace: true, state: {} }); }, 0);
        }
    }, []); // once
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    // nạp danh sách lớp + giáo viên
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getClasses();
                if (!alive) return;
                setClasses(data || []);
                setTeachers((data || []).map((c) => c.mainTeacher).filter(Boolean));
            } catch (e) { if (alive) setErr(pickErr(e)); }
        })();
        return () => { alive = false; };
    }, []);

    async function fetchData() {
        setLoading(true);
        setErr("");
        try {
            const effectiveTeacherId = isTeacher ? (myTeacherId ? Number(myTeacherId) : undefined) : (teacherId ? Number(teacherId) : undefined);
            const effectiveFrom = isTeacher ? todayISO : fromISO;
            const effectiveTo = isTeacher ? todayISO : toISO;

            const data = await listAllSessions({
                from: effectiveFrom || undefined,
                to: effectiveTo || undefined,
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

    // nạp lần đầu + khi myTeacherId sẵn sàng
    useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [isTeacher, myTeacherId]);

    function setThisMonth() {
        const { first, last } = firstLastOfCurrentMonth();
        const fISO = d2input(first); const tISO = d2input(last);
        setFromISO(fISO); setToISO(tISO);
        setFromText(isoToDMY(fISO)); setToText(isoToDMY(tISO));
    }

    const cols = isTeacher ? 5 : 6; // Từ, Đến, Lớp, (Giáo viên), Trạng thái, Nút

    return (
        <>
            {/* Toast success (tự ẩn) */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            <section className="content-header">
                <h1>Tất cả buổi học</h1>
                <small>{isTeacher ? "Giáo viên: chỉ xem buổi của tôi hôm nay" : "Xem/lọc toàn bộ buổi học theo khoảng ngày"}</small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <form
                            className="form-inline"
                            onSubmit={(e) => { e.preventDefault(); fetchData(); }}
                        >
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                    columnGap: 12, rowGap: 6, alignItems: "center", width: "100%",
                                }}
                            >
                                {/* HÀNG 1: NHÃN */}
                                <label className="control-label" style={{ margin: 0 }}>Từ</label>
                                <label className="control-label" style={{ margin: 0 }}>Đến</label>
                                <label className="control-label" style={{ margin: 0 }}>Lớp</label>
                                {!isTeacher && (<label className="control-label" style={{ margin: 0 }}>Giáo viên</label>)}
                                <label className="control-label" style={{ margin: 0 }}>Trạng thái</label>
                                <div />

                                {/* HÀNG 2: Ô NHẬP */}
                                <div>
                                    <input
                                        type="text" className="form-control" style={{ width: "100%", height: 34 }}
                                        placeholder="dd/mm/yyyy" inputMode="numeric" maxLength={10}
                                        value={fromText}
                                        onChange={(e) => {
                                            if (isTeacher) return;
                                            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                            let out = digits;
                                            if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                            else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                            setFromText(out); setFromISO(dmyToISO(out) ?? "");
                                        }}
                                        onBlur={() => { const iso = dmyToISO(fromText); if (iso) setFromText(isoToDMY(iso)); }}
                                        disabled={isTeacher}
                                    />
                                </div>

                                <div>
                                    <input
                                        type="text" className="form-control" style={{ width: "100%", height: 34 }}
                                        placeholder="dd/mm/yyyy" inputMode="numeric" maxLength={10}
                                        value={toText}
                                        onChange={(e) => {
                                            if (isTeacher) return;
                                            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                            let out = digits;
                                            if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                            else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                            setToText(out); setToISO(dmyToISO(out) ?? "");
                                        }}
                                        onBlur={() => { const iso = dmyToISO(toText); if (iso) setToText(isoToDMY(iso)); }}
                                        disabled={isTeacher}
                                    />
                                </div>

                                <div>
                                    <select className="form-control" style={{ width: "100%", height: 34 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
                                        <option value="">(Tất cả)</option>
                                        {classes.map((c) => (
                                            <option key={c.classID ?? c.ClassID ?? c.id} value={String(c.classID ?? c.ClassID ?? c.id)}>
                                                {c.className ?? c.ClassName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {!isTeacher && (
                                    <div>
                                        <select className="form-control" style={{ width: "100%", height: 34 }} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                                            <option value="">(Tất cả)</option>
                                            {teachers.map((t) => (
                                                <option key={t.teacherId ?? t.TeacherId} value={String(t.teacherId ?? t.TeacherId)}>
                                                    {t.teacherName ?? t.TeacherName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <select className="form-control" style={{ width: "100%", height: 34 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                                        <option value="">(Tất cả)</option>
                                        <option value="0">Chưa diễn ra</option>
                                        <option value="1">Hoàn thành</option>
                                        <option value="2">Hủy</option>
                                        <option value="3">NoShow</option>
                                        <option value="4">Dời lịch</option>
                                    </select>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                    <button type="submit" className="btn btn-primary">Lọc</button>
                                    {!isTeacher && (<button type="button" className="btn btn-default" onClick={() => { setThisMonth(); }}>Tháng này</button>)}
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="box-body table-responsive no-padding">
                        {err && (<div className="alert alert-warning" style={{ margin: 10 }}>{String(err)}</div>)}

                        <table className="table table-bordered" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 110 }}>Ngày</th>
                                    <th style={{ width: 120 }}>Thời gian</th>
                                    <th>Lớp</th>
                                    <th style={{ width: 200 }}>Giáo viên</th>
                                    <th style={{ width: 120 }}>Trạng thái</th>
                                    <th style={{ width: 70 }}>Tự sinh</th>
                                    <th>Ghi chú</th>
                                    <th style={{ width: 200 }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={8} className="text-center text-muted">Đang tải…</td></tr>
                                )}
                                {!loading && rows.length === 0 && (
                                    <tr><td colSpan={8} className="text-center text-muted">Không có dữ liệu</td></tr>
                                )}
                                {!loading && rows.map((r, idx) => {
                                    const st = statusBadge(r.status);
                                    const sid = r.sessionId ?? r.SessionId ?? r.id;
                                    const rowKey = sid ?? `${r.sessionDate}-${r.startTime}-${idx}`;
                                    const editable = canEditISOTime(r.sessionDate, r.startTime) && r.status === 0;

                                    return (
                                        <tr key={rowKey}>
                                            <td>{isoToDMY(anyToISO(r.sessionDate))}</td>
                                            <td>{r.startTime}–{r.endTime}</td>
                                            <td>{r.className ?? r.ClassName ?? `#${r.classId ?? r.ClassID}`}</td>
                                            <td>{r.teacherName ?? "—"}</td>
                                            <td><span className={`label ${st.cls}`}>{st.text}</span></td>
                                            <td className="text-center">{r.isAutoGenerated ? "✔" : "—"}</td>
                                            <td>{r.note ?? ""}</td>
                                            <td>
                                                <div className="btn-group btn-group-xs">
                                                    {isAdmin ? (
                                                        <>
                                                            {editable ? (
                                                                <button className="btn btn-primary" onClick={() => navigate(`/sessions/${sid}/edit`)}>
                                                                    <i className="fa fa-edit" /> Sửa
                                                                </button>
                                                            ) : (
                                                                <button className="btn btn-default" onClick={() => navigate(`/sessions/${sid}/edit`)} title="Hết hạn sửa (đã qua giờ bắt đầu hoặc trạng thái khác 0)">
                                                                    <i className="fa fa-lock" /> Xem
                                                                </button>
                                                            )}
                                                            <button className="btn btn-success" onClick={() => navigate(`/sessions/${sid}/attendance`)}>
                                                                <i className="fa fa-check" /> Điểm danh
                                                            </button>
                                                        </>
                                                    ) : isTeacher ? (
                                                        <button className="btn btn-success" onClick={() => navigate(`/sessions/${sid}/attendance`)}>
                                                            <i className="fa fa-check" /> Điểm danh
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-default" onClick={() => navigate(`/sessions/${sid}/edit`)}>
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
                </div>
            </section>
        </>
    );
}
