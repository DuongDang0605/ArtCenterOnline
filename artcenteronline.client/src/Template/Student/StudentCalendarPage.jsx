// src/Template/Student/StudentCalendarPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
function shortTime(ts) {
    return ts || "";
}
// Thêm helper hiển thị trạng thái điểm danh (nếu file này chưa có)
function statusBadgeFor(now, it) {
    // Ưu tiên attendance thực tế:
    if (it.myAttendance === true) return { text: "Có mặt", className: "label label-success" };
    if (it.myAttendance === false) return { text: "Nghỉ", className: "label label-danger" };
    // Suy theo thời điểm hiện tại
    const [y, m, d] = String(it.sessionDate).split("-").map(Number);
    const [sh, sm] = String(it.startTime).split(":").map(Number);
    const [eh, em] = String(it.endTime).split(":").map(Number);
    const start = new Date(y, m - 1, d, sh, sm, 0);
    const end = new Date(y, m - 1, d, eh, em, 0);
    if (now < start) return { text: "Chưa học", className: "label label-default" };
    if (now >= end) return { text: "Nghỉ", className: "label label-danger" };
    return { text: "Chưa học", className: "label label-default" };
}
function getStudentId(st) {
    return st?.studentId ?? st?.StudentId ?? st?.id;
}
function getStudentName(st) {
    return st?.studentName ?? st?.StudentName ?? st?.fullName ?? st?.name ?? "(không tên)";
}

export default function StudentCalendarPage() {
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState("");       // id đã chọn
    const [query, setQuery] = useState("");               // chuỗi người dùng nhập
    const [openDrop, setOpenDrop] = useState(false);      // mở/đóng danh sách gợi ý
    const [hoverIndex, setHoverIndex] = useState(-1);     // item đang highlight trong dropdown
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [byDate, setByDate] = useState({});

    const today = useMemo(() => new Date(), []);
    const { first, last } = useMemo(() => firstLastOfMonth(month), [month]);
    const { start, end } = useMemo(() => gridRange(month), [month]);
    const autoRef = useRef(null);

    // load danh sách học viên
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getStudents();
                if (!alive) return;
                setStudents(Array.isArray(data) ? data : []);
            } catch (e) {
                if (alive) setErr(e?.message || "Tải danh sách học viên thất bại");
            }
        })();
        return () => {
            alive = false;
        };
    }, []); // 1 lần

    // đóng dropdown khi click ra ngoài
    useEffect(() => {
        const onDocClick = (e) => {
            if (!autoRef.current) return;
            if (!autoRef.current.contains(e.target)) {
                setOpenDrop(false);
                setHoverIndex(-1);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // lọc gợi ý theo tên (và id)
    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const arr = students.filter((st) => {
                 // bỏ qua học viên đã nghỉ (Status = 0 hoặc isActive = false)
                    const status = st.status ?? st.Status ?? st.isActive ?? 1;
                if (!status) return false;
            
                    const name = getStudentName(st).toLowerCase();
                 const idStr = String(getStudentId(st) ?? "").toLowerCase();
                return name.includes(q) || idStr.includes(q);
             });
        return arr.slice(0, 12); // giới hạn 12 dòng
    }, [students, query]);

    // chọn 1 học viên từ gợi ý
    function selectStudent(st) {
        const id = getStudentId(st);
        const name = getStudentName(st);
        if (id == null) return;
        setStudentId(String(id));
        setQuery(name);
        setOpenDrop(false);
        setHoverIndex(-1);
    }

    // load lịch theo studentId + tháng
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!studentId) {
                setByDate({});
                return;
            }
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
                for (const s of items || []) {
                    const d = s.sessionDate;
                    (agg[d] ||= []).push({
                        classId: s.classId,
                        className: s.className,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        teacherName: s.teacherName || null,
                        status: s.status,
                        myAttendance: s.myAttendance,
                        sessionDate: s.sessionDate,
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
        return () => {
            alive = false;
        };
    }, [studentId, first, last]);

    // dựng lưới tuần
    const weeks = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekIndex = Math.floor((d - start) / (7 * 24 * 3600 * 1000));
        (weeks[weekIndex] ||= []).push(new Date(d));
    }

    return (
        <>
            <section className="content-header">
                <h1>Lịch theo học viên</h1>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div
                        className="box-header with-border"
                        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                    >
                        {/* Chọn tháng */}
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

                        {/* Ô nhập + dropdown gợi ý học viên */}
                        <div
                            ref={autoRef}
                            className="dropdown"
                            style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}
                        >
                            <label className="small" style={{ margin: 0 }}>
                                Học viên:
                            </label>
                            <div style={{ position: "relative" }}>
                                <input
                                    className="form-control input-sm"
                                    style={{ width: 280, paddingRight: 26 }}
                                    placeholder="Nhập tên học viên…"
                                    value={query}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setQuery(v);
                                        setOpenDrop(true);
                                        // khi gõ lại, bỏ chọn id để tránh hiểu nhầm
                                        setStudentId("");
                                        setByDate({});
                                    }}
                                    onFocus={() => {
                                        if (query.trim()) setOpenDrop(true);
                                    }}
                                    onKeyDown={(e) => {
                                        if (!openDrop && (e.key === "ArrowDown" || e.key === "Enter")) {
                                            setOpenDrop(true);
                                            return;
                                        }
                                        if (!openDrop || suggestions.length === 0) return;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setHoverIndex((p) => (p + 1) % suggestions.length);
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setHoverIndex((p) => (p - 1 + suggestions.length) % suggestions.length);
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            const pick =
                                                hoverIndex >= 0 ? hoverIndex : suggestions.length === 1 ? 0 : -1;
                                            if (pick >= 0) selectStudent(suggestions[pick]);
                                        } else if (e.key === "Escape") {
                                            setOpenDrop(false);
                                            setHoverIndex(-1);
                                        }
                                    }}
                                />
                                {/* nút xóa nhanh */}
                                {query && (
                                    <button
                                        type="button"
                                        title="Xóa"
                                        className="btn btn-link btn-xs"
                                        style={{
                                            position: "absolute",
                                            right: 2,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            textDecoration: "none",
                                        }}
                                        onClick={() => {
                                            setQuery("");
                                            setStudentId("");
                                            setByDate({});
                                            setHoverIndex(-1);
                                            setOpenDrop(false);
                                        }}
                                    >
                                        <i className="fa fa-times text-muted" />
                                    </button>
                                )}

                                {/* dropdown gợi ý */}
                                {openDrop && query.trim() && (
                                    <ul
                                        className="dropdown-menu"
                                        style={{
                                            display: "block",
                                            position: "absolute",
                                            left: 0,
                                            top: "100%",
                                            width: 280,
                                            maxHeight: 260,
                                            overflowY: "auto",
                                            marginTop: 2,
                                        }}
                                    >
                                        {suggestions.length === 0 && (
                                            <li className="disabled">
                                                <a href="#!" onClick={(e) => e.preventDefault()}>
                                                    Không tìm thấy học viên phù hợp
                                                </a>
                                            </li>
                                        )}
                                        {suggestions.map((st, idx) => {
                                            const id = getStudentId(st);
                                            const name = getStudentName(st);
                                            const active = idx === hoverIndex;
                                            return (
                                                <li
                                                    key={id}
                                                    className={active ? "active" : ""}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <a
                                                        href="#!"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            selectStudent(st);
                                                        }}
                                                        onMouseEnter={() => setHoverIndex(idx)}
                                                    >
                                                        <div style={{ fontWeight: 600 }}>{name}</div>
                                                        <div className="text-muted small">ID: {String(id)}</div>
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
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
                        {err && <div className="alert alert-warning" style={{ margin: 10 }}>{err}</div>}
                        {loading && (
                            <div style={{ padding: 10 }}>
                                <i className="fa fa-spinner fa-spin" /> Đang tải…
                            </div>
                        )}

                        {!loading && (
                            <>
                                {!studentId && (
                                    <div style={{ padding: 12 }}>
                                        <span className="text-muted">
                                            Hãy nhập tên và chọn một học viên để xem lịch.
                                        </span>
                                    </div>
                                )}
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
                                                    const itemsSorted = [...items].sort((a, b) =>
                                                        String(a.startTime).localeCompare(String(b.startTime))
                                                    );
                                                    return (
                                                        <td
                                                            key={key}
                                                            style={{
                                                                verticalAlign: "top",
                                                                background: inMonth ? "#fff" : "#f7f7f7",
                                                                minWidth: 180,   // khớp MonthlyCalendar
                                                                height: 130,     // khớp MonthlyCalendar
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
                                                                {itemsSorted.length === 0 && (
                                                                    <span className="text-muted small">—</span>
                                                                )}
                                                                {itemsSorted.map((it, idx) => {
                                                                      const cancelled = Number(it.status) === 2;
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className="small"
                                                                            style={{
                                                                                borderLeft: `3px solid ${cancelled ? "#dd4b39" : "#3c8dbc"
                                                                                    }`, // xanh dương như MonthlyCalendar
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
                            </>
                        )}
                    </div>

                    <div className="box-footer">
                        <span className="text-muted">
                            Nguồn dữ liệu: các buổi thuộc mọi lớp mà học viên đang active trong tháng.
                        </span>
                    </div>
                </div>
            </section>
        </>
    );
}
