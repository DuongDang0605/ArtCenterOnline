// src/Template/Student/StudentSelfCalendarPage.jsx
import { useEffect, useMemo, useState } from "react";
import { getMyProfile } from "./students";
import { listSessionsByStudent, ymd } from "../Session/sessions";

const VN_DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function firstLastOfMonth(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { first, last };
}
function gridRange(d) {
    const { first, last } = firstLastOfMonth(d);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay()); // về CN
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay())); // tới T7
    return { start, end };
}
function isSameDate(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
function shortTime(ts) {
    return ts || ""; // "HH:mm" từ server
}

function statusBadgeFor(now, it) {
    // Ưu tiên theo attendance thực tế nếu có:
    if (it.myAttendance === true) return { text: "Có mặt", className: "label label-success" };
    if (it.myAttendance === false) return { text: "Nghỉ", className: "label label-danger" };

    // Chưa có attendance => suy theo thời điểm hiện tại
    // Ghép Date + Time để so sánh
    const [y, m, d] = String(it.sessionDate).split("-").map(Number);
    const [sh, sm] = String(it.startTime).split(":").map(Number);
    const [eh, em] = String(it.endTime).split(":").map(Number);
    const start = new Date(y, m - 1, d, sh, sm, 0);
    const end = new Date(y, m - 1, d, eh, em, 0);

    if (now < start) return { text: "Chưa học", className: "label label-default" };
    // Nếu đã qua giờ kết thúc mà chưa có attendance → tạm xem là "Absent" cho tới khi GV chấm
    if (now >= end) return { text: "Nghỉ", className: "label label-danger" };
    // Đang trong khung giờ buổi học mà chưa có attendance → vẫn coi là "Chưa học" (chưa chấm)
    return { text: "Chưa học", className: "label label-default" };
}
export default function StudentSelfCalendarPage() {
    const [month, setMonth] = useState(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [me, setMe] = useState(null);
    const [byDate, setByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const today = useMemo(() => new Date(), []);
    const { first, last } = useMemo(() => firstLastOfMonth(month), [month]);
    const { start, end } = useMemo(() => gridRange(month), [month]);

    useEffect(() => {
        (async () => {
            try {
                setErr("");
                const profile = await getMyProfile();
                setMe(profile);
            } catch (e) {
                setErr(e?.message || "Không tải được hồ sơ");
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            if (!me?.studentId) return;
            try {
                setLoading(true);
                setErr("");
                const list = await listSessionsByStudent({
                    studentId: me.studentId,
                    from: ymd(first),
                    to: ymd(last),
                    forCalendar: true,
                });
                const agg = {};
                for (const s of list || []) {
                    (agg[s.sessionDate] ||= []).push(s);
                }
                setByDate(agg);
            } catch (e) {
                setErr(e?.userMessage || e?.message || "Không tải được thời khóa biểu");
            } finally {
                setLoading(false);
            }
        })();
    }, [me, first, last]);

    // dựng lưới tuần
    const weeks = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const w = Math.floor((d - start) / (7 * 24 * 3600 * 1000));
        (weeks[w] ||= []).push(new Date(d));
    }

    return (
        <section className="content">
            <div className="box box-primary">
                <div
                    className="box-header with-border"
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                >
                    <button
                        className="btn btn-default btn-sm"
                        onClick={() =>
                            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                        }
                    >
                        <i className="fa fa-chevron-left" /> Tháng trước
                    </button>

                    <h3 className="box-title" style={{ margin: 0, flex: 1, textAlign: "center" }}>
                        Tháng {month.getMonth() + 1}/{month.getFullYear()}
                    </h3>

                    <button
                        className="btn btn-default btn-sm"
                        onClick={() =>
                            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                        }
                    >
                        Tháng sau <i className="fa fa-chevron-right" />
                    </button>
                </div>

                <div className="box-body table-responsive no-padding">
                    {err && (
                        <div className="alert alert-warning" style={{ margin: 10 }}>
                            {err}
                        </div>
                    )}
                    {loading && (
                        <div style={{ padding: 10 }}>
                            <i className="fa fa-spinner fa-spin" /> Đang tải…
                        </div>
                    )}

                    {!loading && (
                        <table className="table table-bordered" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    {VN_DOW.map((d) => (
                                        <th key={d} style={{ textAlign: "center" }}>
                                            {d}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {weeks.map((week, i) => (
                                    <tr key={i}>
                                        {week.map((d) => {
                                            const inMonth = d.getMonth() === month.getMonth();
                                            const isToday = isSameDate(d, today);
                                            const key = ymd(d);
                                            const items = (byDate[key] || []).sort((a, b) =>
                                                String(a.startTime).localeCompare(String(b.startTime))
                                            );

                                            return (
                                                <td
                                                    key={key}
                                                    style={{
                                                        verticalAlign: "top",
                                                        background: inMonth ? "#fff" : "#f7f7f7",
                                                        minWidth: 180,  // khớp MonthlyCalendar
                                                        height: 130,    // khớp MonthlyCalendar
                                                        padding: 6,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 600 }}>{d.getDate()}</span>
                                                        {isToday && (
                                                            <span className="label label-warning" style={{ lineHeight: 1 }}>
                                                                Hôm nay
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                                                        {items.length === 0 && (
                                                            <span className="text-muted small">—</span>
                                                        )}
                                                        {items.map((it, idx) => {
                                                            const cancelled = Number(it.status) === 2;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="small"
                                                                    style={{
                                                                        borderLeft: `3px solid ${cancelled ? "#dd4b39" : "#3c8dbc"
                                                                            }`, // cùng tông màu MonthlyCalendar
                                                                        paddingLeft: 6,
                                                                        opacity: cancelled ? 0.7 : 1,
                                                                    }}
                                                                    title={cancelled ? "Buổi đã hủy" : ""}
                                                                >
                                                                    <div style={{ fontWeight: 600 }}>
                                                                        {it.className}
                                                                        {cancelled ? " (Hủy)" : ""}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            opacity: 0.85,
                                                                            textDecoration: cancelled ? "line-through" : "none",
                                                                        }}
                                                                    >
                                                                        {shortTime(it.startTime)}–{shortTime(it.endTime)}
                                                                        {it.teacherName ? ` · ${it.teacherName}` : ""}
                                                                        {it.teacherPhone ? ` · ${it.teacherPhone}` : ""}
                                                                    </div>
                                                                    {!cancelled && (
                                                                        <div style={{ marginTop: 2 }}>
                                                                            {(() => {
                                                                                const b = statusBadgeFor(today, it);
                                                                                return <span className={b.className} style={{ lineHeight: 1 }}>{b.text}</span>;
                                                                            })()}
                                                                        </div>
                                                                    )}
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
                    <span className="text-muted">
                        Thời khóa biểu cá nhân — dữ liệu từ các buổi đã sinh trong tháng.
                    </span>
                </div>
            </div>
        </section>
    );
}
