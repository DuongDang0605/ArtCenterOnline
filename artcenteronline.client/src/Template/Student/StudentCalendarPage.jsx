// src/Template/Student/StudentCalendarPage.jsx
import { useEffect, useMemo, useState } from "react";
import { getStudents } from "../Student/students";
import { listSessionsByStudent, ymd } from "../Session/sessions";

// helpers cho lưới tháng (tái sử dụng từ MonthlyCalendar)
const VN_DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
function firstLastOfMonth(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { first, last };
}
function gridRange(date) {
    const { first, last } = firstLastOfMonth(date);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay()); // về CN
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay())); // tới T7
    return { start, end };
}
function isSameDate(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function shortTime(ts) { return ts || ""; }

export default function StudentCalendarPage() {
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [byDate, setByDate] = useState({});

    const today = useMemo(() => new Date(), []);
    const { first, last } = useMemo(() => firstLastOfMonth(month), [month]);
    const { start, end } = useMemo(() => gridRange(month), [month]);

    // load danh sách học viên
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getStudents();
                if (!alive) return;
                setStudents(data || []);
                // auto-chọn học viên đầu tiên (nếu muốn)
                if (!studentId && Array.isArray(data) && data.length > 0) {
                    const anyId = data[0].studentId ?? data[0].StudentId ?? data[0].id;
                    setStudentId(String(anyId ?? ""));
                }
            } catch (e) {
                if (alive) setErr(e?.message || "Tải danh sách học viên thất bại");
            }
        })();
        return () => { alive = false; };
    }, []); // 1 lần

    // load lịch theo studentId + tháng
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!studentId) { setByDate({}); return; }
            try {
                setLoading(true);
                setErr("");
                const items = await listSessionsByStudent({
                    studentId: Number(studentId),
                    from: ymd(first),
                    to: ymd(last),
                    forCalendar: true,
                });
                // group theo ngày
                const agg = {};
                for (const s of items) {
                    const d = s.sessionDate;
                    if (!agg[d]) agg[d] = [];
                    agg[d].push({
                        classId: s.classId,
                        className: s.className,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        teacherName: s.teacherName || null,
                        status: s.status,
                    });
                }
                if (!alive) return;
                setByDate(agg);
            } catch (e) {
                if (alive) setErr(e?.userMessage || e?.message || "Tải lịch thất bại");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [studentId, first, last]);

    // dựng lưới tuần
    const weeks = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekIndex = Math.floor((d - start) / (7 * 24 * 3600 * 1000));
        if (!weeks[weekIndex]) weeks[weekIndex] = [];
        weeks[weekIndex].push(new Date(d));
    }

    return (
        <>
            <section className="content-header">
                <h1>Lịch theo học viên</h1>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {/* Chọn tháng */}
                        <button className="btn btn-default btn-sm"
                            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                        >
                            <i className="fa fa-chevron-left" /> Tháng trước
                        </button>

                        <h3 className="box-title" style={{ margin: 0, flex: 1, textAlign: "center" }}>
                            Tháng {month.getMonth() + 1}/{month.getFullYear()}
                        </h3>

                        {/* Chọn học viên */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label className="small" style={{ margin: 0 }}>Học viên:</label>
                            <select
                                className="form-control input-sm"
                                style={{ width: 280 }}
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                            >
                                <option value="">-- Chọn học viên --</option>
                                {students.map((st) => {
                                    const id = st.studentId ?? st.StudentId ?? st.id;
                                    const name = st.studentName ?? st.StudentName ?? "(không tên)";
                                    return <option key={id} value={String(id)}>{name}</option>;
                                })}
                            </select>
                        </div>

                        <button className="btn btn-default btn-sm"
                            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                        >
                            Tháng sau <i className="fa fa-chevron-right" />
                        </button>
                    </div>

                    <div className="box-body table-responsive no-padding">
                        {err && <div className="alert alert-warning" style={{ margin: 10 }}>{err}</div>}
                        {loading && <div style={{ padding: 10 }}><i className="fa fa-spinner fa-spin" /> Đang tải…</div>}

                        {!loading && (
                            <table className="table table-bordered" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        {VN_DOW.map((lbl) => <th key={lbl} style={{ textAlign: "center" }}>{lbl}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {weeks.map((week, wi) => (
                                        <tr key={wi}>
                                            {week.map((d) => {
                                                const inMonth = d.getMonth() === month.getMonth();
                                                const isToday = isSameDate(d, today);
                                                const key = ymd(d);
                                                const items = byDate[key] || [];
                                                const itemsSorted = [...items].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
                                                return (
                                                    <td key={key}
                                                        style={{
                                                            verticalAlign: "top",
                                                            background: inMonth ? "#fff" : "#f7f7f7",
                                                            minWidth: 220,
                                                            height: 140,
                                                            padding: 6,
                                                        }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ fontWeight: 600 }}>{d.getDate()}</span>
                                                            {isToday && <span className="label label-warning" style={{ lineHeight: 1 }}>Hôm nay</span>}
                                                        </div>

                                                        <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                                                            {itemsSorted.length === 0 && <span className="text-muted small">—</span>}
                                                            {itemsSorted.map((it, idx) => {
                                                                const isCancelled = Number(it.status) === 2;
                                                                return (
                                                                    <div key={idx} className="small"
                                                                        style={{
                                                                            borderLeft: `3px solid ${isCancelled ? "#dd4b39" : "#00a65a"}`,
                                                                            paddingLeft: 6,
                                                                            opacity: isCancelled ? 0.7 : 1,
                                                                        }}
                                                                        title={isCancelled ? "Buổi đã hủy" : ""}>
                                                                        <div style={{ fontWeight: 600 }}>
                                                                            {it.className}{isCancelled ? " (Hủy)" : ""}
                                                                        </div>
                                                                        <div style={{ opacity: 0.85, textDecoration: isCancelled ? "line-through" : "none" }}>
                                                                            {shortTime(it.startTime)}–{shortTime(it.endTime)}
                                                                            {it.teacherName ? ` · ${it.teacherName}` : ""}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="box-footer">
                        <span className="text-muted">Nguồn dữ liệu: các buổi thuộc mọi lớp mà học viên đang active trong tháng.</span>
                    </div>
                </div>
            </section>
        </>
    );
}
