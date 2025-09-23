// src/Template/Session/SessionsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { listAllSessions } from "./sessions";
import { getClasses } from "../Class/classes";
import { getTeachers } from "../Teacher/teachers";
import { useAuth } from "../../auth/authCore";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

function firstLastOfCurrentMonth() {
    const now = new Date();
    return { first: new Date(now.getFullYear(), now.getMonth(), 1), last: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
}
function d2input(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function isoToDMY(iso) { if (!iso) return ""; const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; }
function dmyToISO(dmy) { if (!dmy) return ""; const parts = dmy.split("/"); if (parts.length !== 3) return ""; const [d, m, y] = parts; return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
function anyToISO(x) { if (!x) return ""; if (x instanceof Date) return d2input(x); if (typeof x === "string" && x.includes("-")) return x.slice(0, 10); return ""; }
function statusBadge(s) {
    const map = { 0: { text: "Chưa diễn ra", cls: "label-default" }, 1: { text: "Hoàn thành", cls: "label-success" }, 2: { text: "Hủy", cls: "label-danger" }, 3: { text: "NoShow", cls: "label-warning" }, 4: { text: "Dời lịch", cls: "label-info" } };
    return map[s] || { text: String(s), cls: "label-default" };
}

export default function SessionsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();

    const { showError, showSuccess, Toasts } = useToasts();

    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");
    const myTeacherId = auth?.user?.teacherId ?? auth?.user?.TeacherId ?? auth?.user?.teacher?.teacherId ?? auth?.user?.teacher?.TeacherId ?? "";

    const today = new Date();
    const todayISO = d2input(today);
    const { first, last } = firstLastOfCurrentMonth();
    const monthFirstISO = d2input(first);
    const monthLastISO = d2input(last);

    // Teacher & Admin: mặc định cả THÁNG
    const [fromISO, setFromISO] = useState(monthFirstISO);
    const [toISO, setToISO] = useState(monthLastISO);
    const [fromText, setFromText] = useState(isoToDMY(monthFirstISO));
    const [toText, setToText] = useState(isoToDMY(monthLastISO));

    const [classId, setClassId] = useState("");
    const [teacherId, setTeacherId] = useState(isTeacher ? String(myTeacherId || "") : "");
    const [status, setStatus] = useState("");

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]); // [{id, name}]
    const [rows, setRows] = useState([]);

    const [loading, setLoading] = useState(true);

    // Nhận success từ trang khác (notice/flash) -> toast + clear state
    useEffect(() => {
        const n = location?.state?.notice || location?.state?.flash;
        if (n) {
            showSuccess(String(n));
            setTimeout(() => navigate(location.pathname, { replace: true, state: {} }), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // nạp lớp + giáo viên
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [cls, tchs] = await Promise.all([getClasses(), getTeachers()]);
                if (!alive) return;
                setClasses(cls || []);

                const seen = new Set(); const list = [];
                (tchs || []).forEach((t) => {
                    const id = Number(t.teacherId ?? t.TeacherId);
                    if (!id || seen.has(id)) return;
                    seen.add(id);
                    const name = t.teacherName ?? t.TeacherName ?? `GV #${id}`;
                    list.push({ id, name });
                });
                list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
                setTeachers(list);
            } catch (e) {
                const s = e?.response?.status;
                if (s === 401) {
                    navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                    return;
                }
                showError(extractErr(e) || "Không tải được dữ liệu.");
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const effectiveTeacherId = isTeacher
                ? (myTeacherId ? Number(myTeacherId) : undefined)
                : (teacherId ? Number(teacherId) : undefined);

            const effectiveFrom = isTeacher ? monthFirstISO : fromISO;
            const effectiveTo = isTeacher ? monthLastISO : toISO;

            const data = await listAllSessions({
                from: effectiveFrom || undefined,
                to: effectiveTo || undefined,
                classId: classId ? Number(classId) : undefined,
                teacherId: effectiveTeacherId,
                status: status === "" ? undefined : Number(status),
            });
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            const s = e?.response?.status;
            if (s === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
            } else {
                showError(extractErr(e) || "Tải danh sách buổi học thất bại.");
            }
            setRows([]);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [isTeacher, myTeacherId]);

    function setThisMonth() {
        const { first, last } = firstLastOfCurrentMonth();
        const fISO = d2input(first); const tISO = d2input(last);
        setFromISO(fISO); setToISO(tISO);
        setFromText(isoToDMY(fISO)); setToText(isoToDMY(tISO));
    }

    // Admin cho sửa nếu ngày thuộc [hôm nay .. hết tháng]
    function adminCanEditByDate(dateIso) {
        if (!dateIso) return false;
        const [y, m, d] = dateIso.split("-").map(Number);
        const sDate = new Date(y, m - 1, d);
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return sDate >= start && sDate <= end;
    }

    const cols = isTeacher ? 5 : 6;

    return (
        <>
            <section className="content-header">
                <h1>Tất cả buổi học</h1>
                <small>{isTeacher ? "Giáo viên: xem tất cả buổi trong tháng của tôi" : "Xem/lọc toàn bộ buổi học theo khoảng ngày"}</small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <form className="form-inline" onSubmit={(e) => { e.preventDefault(); fetchData(); }}>
                            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 12, rowGap: 6, alignItems: "center", width: "100%" }}>
                                <label className="control-label" style={{ margin: 0 }}>Từ</label>
                                <label className="control-label" style={{ margin: 0 }}>Đến</label>
                                <label className="control-label" style={{ margin: 0 }}>Lớp</label>
                                {!isTeacher && (<label className="control-label" style={{ margin: 0 }}>Giáo viên</label>)}
                                <label className="control-label" style={{ margin: 0 }}>Trạng thái</label>
                                <div />

                                <div>
                                    <input
                                        type="text" className="form-control" style={{ width: "100%", height: 34 }}
                                        placeholder="dd/mm/yyyy" inputMode="numeric" maxLength={10}
                                        value={fromText}
                                        onChange={(e) => {
                                            if (isTeacher) return; // Teacher khóa khoảng ngày về cả tháng
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
                                                <option key={t.id} value={String(t.id)}>
                                                    {t.name}
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
                                {loading && (<tr><td colSpan={8} className="text-center text-muted">Đang tải…</td></tr>)}
                                {!loading && rows.length === 0 && (<tr><td colSpan={8} className="text-center text-muted">Không có dữ liệu</td></tr>)}
                                {!loading && rows.map((r, idx) => {
                                    const st = statusBadge(r.status);
                                    const sid = r.sessionId ?? r.SessionId ?? r.id;
                                    const rowKey = sid ?? `${r.sessionDate}-${r.startTime}-${idx}`;

                                    const isToday = anyToISO(r.sessionDate) === todayISO;

                                    // Admin: sửa theo cửa sổ hôm nay → hết tháng
                                    const adminWindowOk = isAdmin && adminCanEditByDate(anyToISO(r.sessionDate));

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
                                                            {adminWindowOk ? (
                                                                <button className="btn btn-primary" onClick={() => navigate(`/sessions/${sid}/edit`)}>
                                                                    <i className="fa fa-edit" /> Sửa
                                                                </button>
                                                            ) : (
                                                                <button className="btn btn-default" onClick={() => navigate(`/sessions/${sid}/edit`)} title="Ngoài cửa sổ sửa của Admin (chỉ hôm nay → hết tháng)">
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

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
