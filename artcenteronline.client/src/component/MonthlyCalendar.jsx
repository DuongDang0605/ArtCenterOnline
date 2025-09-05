/* eslint-disable no-unused-vars */
// src/component/MonthlyCalendar.jsx
import { useEffect, useMemo, useState } from "react";
import { getClasses } from "../Template/Class/classes";
import { listSessions } from "../Template/Session/sessions";

const VN_DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function isSameDate(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
function firstLastOfMonth(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { first, last };
}
function gridRange(date) {
    const { first, last } = firstLastOfMonth(date);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay()); // về Chủ nhật
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay())); // tới Thứ bảy
    return { start, end };
}
function shortTime(ts) {
    return ts || ""; // server trả "HH:mm"
}

export default function MonthlyCalendar() {
    const [month, setMonth] = useState(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // {'YYYY-MM-DD': [{classId, className, startTime, endTime, teacherName, status}]}
    const [byDate, setByDate] = useState({});
    const [retryKey, setRetryKey] = useState(0); // tăng để kích hoạt retry

    // Danh sách lớp & filter theo lớp
    const [classes, setClasses] = useState([]); // [{classID, className, ...}]
    const [selectedClassId, setSelectedClassId] = useState("all");

    const today = useMemo(() => new Date(), []);
    const { first, last } = useMemo(() => firstLastOfMonth(month), [month]);
    const { start, end } = useMemo(() => gridRange(month), [month]);

    // helper: retry 2 lần nếu call fail
    async function retryGetClasses() {
        let lastErr = null;
        for (let i = 0; i < 3; i++) {
            try {
                const cls = await getClasses();
                return cls || [];
            } catch (e) {
                lastErr = e;
                // đợi 800ms rồi thử lại
                await new Promise((r) => setTimeout(r, 800));
            }
        }
        throw lastErr;
    }

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");

                // 1) lấy danh sách lớp (có retry)
                let cls = [];
                try {
                    cls = await retryGetClasses();
                } catch (_e) {
                    if (!alive) return;
                    setErr("Server chưa sẵn sàng, sẽ thử lại...");
                    setTimeout(() => {
                        if (alive) setRetryKey((k) => k + 1);
                    }, 1200);
                    setLoading(false);
                    return;
                }
                if (!alive) return;
                setClasses(cls);

                // 2) lấy buổi học cho từng lớp trong tháng (ignore lỗi từng lớp)
                const settled = await Promise.allSettled(
                    cls.map(async (c) => {
                        const arr = await listSessions({
                            classId: Number(c.classID ?? c.ClassID ?? c.id),
                            from: ymd(first),
                            to: ymd(last),
                            forCalendar: true,
                        });
                        return arr.map((s) => ({
                            date: s.sessionDate, // "yyyy-MM-dd"
                            classId: Number(c.classID ?? c.ClassID ?? c.id),
                            className: c.className ?? c.ClassName ?? "",
                            startTime: s.startTime, // "HH:mm"
                            endTime: s.endTime,
                            teacherName: s.teacherName || null,
                            status: s.status, // 0..4
                        }));
                    })
                );

                // 3) gộp theo ngày (chỉ gom những lớp load OK)
                const agg = {};
                for (const res of settled) {
                    if (res.status !== "fulfilled") continue;
                    for (const it of res.value) {
                        if (!agg[it.date]) agg[it.date] = [];
                        agg[it.date].push(it);
                    }
                }

                if (!alive) return;
                setByDate(agg);
            } catch (e) {
                if (alive) setErr(e?.message || "Tải lịch thất bại");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
        // retryKey để trigger thử lại khi server chưa sẵn sàng
    }, [first, last, retryKey]);

    // dựng lưới tuần
    const weeks = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekIndex = Math.floor((d - start) / (7 * 24 * 3600 * 1000));
        if (!weeks[weekIndex]) weeks[weekIndex] = [];
        weeks[weekIndex].push(new Date(d));
    }

    return (
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

                <h3
                    className="box-title"
                    style={{ margin: 0, flex: 1, textAlign: "center" }}
                >
                    Lịch tháng {month.getMonth() + 1}/{month.getFullYear()}
                </h3>

                {/* Filter theo lớp */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label className="small" style={{ margin: 0 }}>
                        Lọc lớp:
                    </label>
                    <select
                        className="form-control input-sm"
                        style={{ width: 220 }}
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                        <option value="all">Tất cả lớp</option>
                        {classes.map((c) => (
                            <option key={c.classID ?? c.ClassID ?? c.id} value={String(c.classID ?? c.ClassID ?? c.id)}>
                                {c.className ?? c.ClassName ?? "(không tên)"}
                            </option>
                        ))}
                    </select>
                </div>

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
                {/* Chỉ hiển thị cảnh báo nhẹ, không chặn UI */}
                {err && <div className="alert alert-warning" style={{ margin: 10 }}>{err}</div>}
                {loading && <div style={{ padding: 10, color: "#888" }}>Đang tải lịch…</div>}

                {!loading && (
                    <table className="table table-bordered" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                {VN_DOW.map((lbl) => (
                                    <th key={lbl} style={{ textAlign: "center" }}>
                                        {lbl}
                                    </th>
                                ))}
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

                                        // Áp dụng filter theo lớp (classId)
                                        const filteredItems =
                                            selectedClassId === "all"
                                                ? items
                                                : items.filter(
                                                    (it) => it.classId === Number(selectedClassId)
                                                );
                                        // Sắp xếp theo giờ bắt đầu trong ngày (HH:mm)
                                        const filteredItemsSorted = [...filteredItems].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

                                        return (
                                            <td
                                                key={key}
                                                style={{
                                                    verticalAlign: "top",
                                                    // Giữ nền trắng để "cam hôm nay" nhỏ lại (chỉ hiển thị nhãn nhỏ)
                                                    background: inMonth ? "#fff" : "#f7f7f7",
                                                    minWidth: 180,
                                                    height: 130,
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
                                                    {filteredItemsSorted.length === 0 && (
                                                        <span className="text-muted small">—</span>
                                                    )}

                                                    {/* Hiện TẤT CẢ buổi, không còn slice */}
                                                    {filteredItemsSorted.map((it, idx) => {
                                                        const isCancelled = Number(it.status) === 2;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="small"
                                                                style={{
                                                                    borderLeft: `3px solid ${isCancelled ? "#dd4b39" : "#3c8dbc"}`,
                                                                    paddingLeft: 6,
                                                                    opacity: isCancelled ? 0.7 : 1,
                                                                }}
                                                                title={isCancelled ? "Buổi đã hủy" : ""}
                                                            >
                                                                <div style={{ fontWeight: 600 }}>
                                                                    {it.className}
                                                                    {isCancelled ? " (Hủy)" : ""}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        opacity: 0.85,
                                                                        textDecoration: isCancelled ? "line-through" : "none",
                                                                    }}
                                                                >
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
                <span className="text-muted">
                    Dữ liệu lấy từ buổi học đã sinh (tất cả lớp). Chỉnh tại “Class → Xét lịch
                    học → Lên lịch tháng này”.
                </span>
            </div>
        </div>
    );
}
