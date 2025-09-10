import { useEffect, useMemo, useState } from "react";
import { getMyProfile } from "./students";
import { listSessionsByStudent, ymd } from "../Session/sessions";

const VN_DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const firstLast = (d) => ({ first: new Date(d.getFullYear(), d.getMonth(), 1), last: new Date(d.getFullYear(), d.getMonth() + 1, 0) });
const gridRange = (d) => { const { first, last } = firstLast(d); const s = new Date(first); s.setDate(s.getDate() - s.getDay()); const e = new Date(last); e.setDate(e.getDate() + (6 - e.getDay())); return { start: s, end: e }; };
const sameDate = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function StudentSelfCalendarPage() {
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [me, setMe] = useState(null);
    const [byDate, setByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const today = useMemo(() => new Date(), []);
    const { first, last } = useMemo(() => firstLast(month), [month]);
    const { start, end } = useMemo(() => gridRange(month), [month]);

    useEffect(() => {
        (async () => {
            try { setErr(""); setMe(await getMyProfile()); }
            catch (e) { setErr(e?.message || "Không tải được hồ sơ"); }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            if (!me?.studentId) return;
            try {
                setLoading(true); setErr("");
                const list = await listSessionsByStudent({ studentId: me.studentId, from: ymd(first), to: ymd(last), forCalendar: true });
                const agg = {}; for (const s of list) { (agg[s.sessionDate] ||= []).push(s); }
                setByDate(agg);
            } catch (e) { setErr(e?.userMessage || e?.message || "Không tải được thời khóa biểu"); }
            finally { setLoading(false); }
        })();
    }, [me, first, last]);

    const weeks = []; for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { const w = Math.floor((d - start) / (7 * 24 * 3600 * 1000)); (weeks[w] ||= []).push(new Date(d)); }

    return (
        <section className="content">
            <div className="box box-primary">
                <div className="box-header with-border" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-default btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><i className="fa fa-chevron-left" /> Tháng trước</button>
                    <h3 className="box-title" style={{ margin: 0, flex: 1, textAlign: "center" }}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</h3>
                    <button className="btn btn-default btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Tháng sau <i className="fa fa-chevron-right" /></button>
                </div>

                <div className="box-body table-responsive no-padding">
                    {err && <div className="alert alert-warning" style={{ margin: 10 }}>{err}</div>}
                    {loading && <div style={{ padding: 10 }}><i className="fa fa-spinner fa-spin" /> Đang tải…</div>}
                    {!loading && (
                        <table className="table table-bordered" style={{ margin: 0 }}>
                            <thead><tr>{VN_DOW.map(d => <th key={d} style={{ textAlign: "center" }}>{d}</th>)}</tr></thead>
                            <tbody>
                                {weeks.map((week, i) => (
                                    <tr key={i}>
                                        {week.map(d => {
                                            const inMonth = d.getMonth() === month.getMonth();
                                            const isToday = sameDate(d, today);
                                            const key = ymd(d);
                                            const items = (byDate[key] || []).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
                                            return (
                                                <td key={key} style={{ verticalAlign: "top", background: inMonth ? "#fff" : "#f7f7f7", minWidth: 220, height: 140, padding: 6 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}><b>{d.getDate()}</b>{isToday && <span className="label label-warning">Hôm nay</span>}</div>
                                                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                                                        {items.length === 0 && <span className="text-muted small">—</span>}
                                                        {items.map((it, idx) => {
                                                            const cancelled = Number(it.status) === 2;
                                                            return (
                                                                <div key={idx} className="small" style={{ borderLeft: `3px solid ${cancelled ? "#dd4b39" : "#00a65a"}`, paddingLeft: 6, opacity: cancelled ? 0.7 : 1 }}>
                                                                    <div style={{ fontWeight: 600 }}>{it.className}{cancelled ? " (Hủy)" : ""}</div>
                                                                    <div style={{ opacity: 0.85, textDecoration: cancelled ? "line-through" : "none" }}>
                                                                        {it.startTime}–{it.endTime}
                                                                        {it.teacherName ? ` · ${it.teacherName}` : ""}
                                                                        {it.teacherPhone ? ` · ${it.teacherPhone}` : ""}
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
            </div>
        </section>
    );
}
