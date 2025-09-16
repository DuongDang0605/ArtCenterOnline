/* eslint-disable no-unused-vars */
// src/Template/Reports/ReportsDashboardPage.jsx
import React, { useEffect, useState } from "react";
import { Chart } from "chart.js/auto";
import { getMonthlyOverview } from "../../api/reports";
import { readAuth } from "../../auth/authCore";
import http from "../../api/http"; // axios có sẵn token

// ==== Helpers số ====
const num = (x, digits = 1) =>
    Number.isFinite(Number(x)) ? Number(x).toFixed(digits) : (0).toFixed(digits);
const pct = (x, digits = 1) => `${num(x, digits)}%`;

// Chênh tuyệt đối HV so với T-1 (màu theo tăng/giảm)
const deltaCountText = (cur, prev) => {
    const a = Number(cur ?? 0), b = Number(prev ?? 0);
    const d = a - b;
    const sign = d > 0 ? "+" : d < 0 ? "" : "±";
    const cls = d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-muted";
    return { text: `${sign}${Math.abs(d)} HV so với T-1`, cls };
};

// Badge % tăng/giảm (dùng cho KPI có %)
const TrendBadge = ({ delta }) => {
    const v = Number(delta ?? 0);
    const up = v > 0, down = v < 0;
    const cls = up ? "badge badge-success" : down ? "badge badge-danger" : "badge badge-secondary";
    const sign = up ? "+" : down ? "" : "±";
    return <span className={`${cls} ml-2`}>{sign}{Math.abs(v).toFixed(1)}%</span>;
};
// --- ADD: helpers ngày kiểu dd/MM/yyyy <-> yyyy-MM-dd
function isoToDMY(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
}
function dmyToISO(dmy) {
    if (!dmy) return "";
    const parts = dmy.split("/");
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}


// KPI card (nhỏ gọn, sát style AdminLTE)
const Kpi = ({ color = "bg-info", icon = "fa-chart-line", title, value, sub, deltaPct }) => (
    <div className="col-lg-3 col-sm-6 col-12">
        <div className={`small-box ${color} elevation-2 kpi-box`}>
            <div className="inner">
                <h3 className="kpi-value">{value}</h3>
                <p className="mb-2 kpi-title">{title}</p>
                <div className="kpi-sub text-light">
                    {sub && (typeof sub === "string" ? <small>{sub}</small> : sub)}
                    {deltaPct !== undefined && <TrendBadge delta={deltaPct} />}
                </div>
            </div>
            <div className="icon kpi-icon">
                <i className={`fa ${icon}`} />
            </div>
        </div>
    </div>
);

export default function ReportsDashboardPage() {
    const user = readAuth()?.user;
    const isAdmin = !!user?.roles?.some((r) => String(r).toLowerCase() === "admin");

    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [data, setData] = useState(null);

    // ==== Helpers chuyển tháng -> khoảng ngày (yyyy-MM-dd) ====
    const ymToRange = (ym) => {
        const [yy, mm] = ym.split("-").map(Number);
        const start = new Date(yy, mm - 1, 1);
        const end = new Date(yy, mm, 0);
        const fmt2 = (n) => String(n).padStart(2, "0");
        const toStr = (d) =>
            `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
        return { from: toStr(start), to: toStr(end), start, end };
    };
    const prevMonthYm = (ym) => {
        const [yy, mm] = ym.split("-").map(Number);
        const d = new Date(yy, mm - 2, 1);
        const fmt2 = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}`;
    };

    // ==== LOGIN theo ngày trong tháng + KPI tháng này/tháng trước ====
    const [loginDailyMonth, setLoginDailyMonth] = useState([]);
    const [loginDailyPrev, setLoginDailyPrev] = useState([]);

    useEffect(() => {
        let alive = true;
        const { from, to } = ymToRange(month);
        const ymPrev = prevMonthYm(month);
        const { from: pFrom, to: pTo } = ymToRange(ymPrev);
        (async () => {
            try {
                const { data: d1 } = await http.get("/Reports/logins/daily", { params: { from, to } });
                const { data: d2 } = await http.get("/Reports/logins/daily", { params: { from: pFrom, to: pTo } });
                if (alive) {
                    setLoginDailyMonth(Array.isArray(d1) ? d1 : []);
                    setLoginDailyPrev(Array.isArray(d2) ? d2 : []);
                }
            } catch { /* ignore */ }
        })();
        return () => { alive = false; };
    }, [month]);

    const sumLogins = (arr) =>
        arr.reduce(
            (s, x) =>
                s +
                Number(x?.TeacherLogins ?? x?.teacherLogins ?? 0) +
                Number(x?.StudentLogins ?? x?.studentLogins ?? 0),
            0
        );
    const totalLoginsThis = sumLogins(loginDailyMonth);
    const totalLoginsPrev = sumLogins(loginDailyPrev);

    useEffect(() => {
        // Bar chart Teacher vs Student by day (current month)
        const el = document.getElementById("loginByDayBar");
        if (!el) return;
        if (window._loginByDayBar) {
            window._loginByDayBar.destroy();
            window._loginByDayBar = null;
        }

        const labels = loginDailyMonth.map((x) => x?.Date ?? x?.date ?? "");
        const tData = loginDailyMonth.map(
            (x) => Number(x?.TeacherLogins ?? x?.teacherLogins ?? 0)
        );
        const sData = loginDailyMonth.map(
            (x) => Number(x?.StudentLogins ?? x?.studentLogins ?? 0)
        );

        window._loginByDayBar = new Chart(el, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    { label: "Teacher", data: tData, backgroundColor: "#17a2b8" },
                    { label: "Student", data: sData, backgroundColor: "#6f42c1" },
                ],
            },
            options: {
                responsive: true,
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            },
        });
    }, [loginDailyMonth]);

    // ==== Modal: danh sách lượt đăng nhập trong tháng (THÊM lọc ngày + phân trang) ====
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginEvents, setLoginEvents] = useState([]);
    const [loginEventsLoad, setLoginEventsLoad] = useState(false);
    const [loginEventsErr, setLoginEventsErr] = useState("");

    // NEW: khoảng ngày filter trong modal
    const [modalFrom, setModalFrom] = useState("");
    const [modalTo, setModalTo] = useState("");

    // NEW: phân trang (client-side)
    const [pageSize, setPageSize] = useState(20);
    const [pageIndex, setPageIndex] = useState(1); // 1-based

    // NEW: text hiển thị dd/MM/yyyy
    const [modalFromText, setModalFromText] = useState("");
    const [modalToText, setModalToText] = useState("");

    const fmtLocal = (s) => (s ? String(s).replace("T", " ").slice(0, 16) : "");
    // Chọn tên hiển thị theo role
    const getLoginName = (e) => {
        const role = String(e?.role || "").toLowerCase();
        const tName = e?.teacherName ?? e?.TeacherName;
        const sName = e?.studentName ?? e?.StudentName;
        const full = e?.fullName;
        const uid = e?.userId ?? e?.email ?? "-";

        if (role === "teacher") return tName;
        if (role === "student") return sName;
        return full ?? tName ?? sName ?? uid;
    };


    // NEW: tải danh sách theo khoảng ngày
    const loadLoginEvents = async (rangeFrom, rangeTo) => {
        try {
            setLoginEventsLoad(true);
            setLoginEventsErr("");
            const { data } = await http.get("/Reports/logins/events", {
                params: { from: rangeFrom, to: rangeTo },
            });
            setLoginEvents(Array.isArray(data) ? data : []);
            setPageIndex(1); // reset về trang 1 mỗi lần reload
        } catch (e) {
            setLoginEvents([]);
            setLoginEventsErr(
                e?.response?.data?.title || e.message || "Không tải được danh sách"
            );
        } finally {
            setLoginEventsLoad(false);
        }
    };

    // Derived cho phân trang
    const totalRows = loginEvents.length;
    const startIdx = (pageIndex - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRows);
    const pageRows = loginEvents.slice(startIdx, endIdx);
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    // ===== Fetch (GIỮ NGUYÊN): tổng quan tháng =====
    useEffect(() => {
        if (!isAdmin) return;
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const dto = await getMonthlyOverview(month); // "yyyy-MM" hoặc "yyyy-MM-01"
                if (alive) setData(dto ?? {});
            } catch (e) {
                setErr(e?.response?.data?.title || e.message);
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [month, isAdmin]);

    // 1) Biểu đồ đường: attendance theo ngày, 2 series This/Prev (GIỮ NGUYÊN)
    useEffect(() => {
        if (!data) return;
        const el = document.getElementById("attChart");
        if (!el) return;

        if (window._attChart) {
            window._attChart.destroy();
            window._attChart = null;
        }

        const [yStr, mStr] = String(data?.month ?? month).split("-");
        const y = Number(yStr),
            m = Number(mStr);
        const daysInMonth =
            Number.isFinite(y) && Number.isFinite(m)
                ? new Date(y, m, 0).getDate()
                : 31;

        const labels = Array.from({ length: daysInMonth }, (_, i) =>
            String(i + 1).padStart(2, "0")
        );

        const toDict = (ser = []) => {
            const d = {};
            for (const p of ser) {
                const day = Number(p?.label);
                const val = Number(p?.value);
                if (
                    Number.isFinite(day) &&
                    day >= 1 &&
                    day <= 31 &&
                    Number.isFinite(val)
                )
                    d[day] = val;
            }
            return d;
        };
        const dThis = toDict(data?.attendanceSeries ?? []);
        const dPrev = toDict(data?.attendanceSeriesPrev ?? []);

        const now = new Date();
        const nowY = now.getFullYear();
        const nowM = now.getMonth() + 1;
        const curFirst = new Date(nowY, nowM - 1, 1);
        const selFirst = new Date(y, (m || 1) - 1, 1);

        const isCurrentMonth = y === nowY && m === nowM;
        const isFutureMonth = selFirst > curFirst;
        const maxDayThis = isCurrentMonth ? now.getDate() : isFutureMonth ? 0 : daysInMonth;

        const yThis = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            return day <= maxDayThis ? dThis[day] ?? NaN : NaN;
        });
        const yPrev = Array.from({ length: daysInMonth }, (_, i) => dPrev[i + 1] ?? NaN);

        window._attChart = new Chart(el, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Tháng này",
                        data: yThis,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        tension: 0,
                        spanGaps: false,
                        borderColor: "#007bff",
                        backgroundColor: "rgba(0,123,255,.08)",
                    },
                    {
                        label: "Tháng trước",
                        data: yPrev,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointStyle: "rect",
                        tension: 0,
                        spanGaps: false,
                        borderDash: [6, 6],
                        borderColor: "#ff5c8a",
                        backgroundColor: "rgba(255,92,138,.08)",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            title: (items) => `Ngày ${items[0].label}`,
                            label: (item) =>
                                `${item.dataset.label}: ${Number(item.parsed.y).toFixed(1)}%`,
                        },
                    },
                },
                scales: {
                    y: {
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: { callback: (v) => `${v}%` },
                    },
                },
                interaction: { mode: "nearest", intersect: false },
            },
        });
    }, [data, month]);

    // 2) Bar: số buổi trong tháng (hoàn thành/hủy) (GIỮ NGUYÊN)
    useEffect(() => {
        if (!data) return;
        const el = document.getElementById("sessionsBar");
        if (!el) return;

        if (window._sessionsBar) {
            window._sessionsBar.destroy();
            window._sessionsBar = null;
        }

        const doneThis = Number(data?.sessionsThisMonth ?? 0);
        const cancelThis = Number(data?.sessionsCanceled ?? 0);

        const donePrev = Number(data?.sessionsThisMonthPrev ?? 0);
        const cancelPrev = Number(data?.sessionsCanceledPrev ?? 0);

        window._sessionsBar = new Chart(el, {
            type: "bar",
            data: {
                labels: ["Tháng này", "Tháng trước"],
                datasets: [
                    {
                        label: "Hoàn thành",
                        data: [Math.max(0, doneThis), Math.max(0, donePrev)],
                        backgroundColor: "#17a2b8",
                    },
                    {
                        label: "Hủy",
                        data: [Math.max(0, cancelThis), Math.max(0, cancelPrev)],
                        backgroundColor: "#ffc107",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            },
        });
    }, [data]);

    // 3) Biểu đồ tròn: tỉ lệ điểm danh (This/Prev) — GIỮ NGUYÊN
    useEffect(() => {
        if (!data) return;
        const elThis = document.getElementById("attPieThis");
        const elPrev = document.getElementById("attPiePrev");
        if (!elThis || !elPrev) return;

        if (window._attPieThis) {
            window._attPieThis.destroy();
            window._attPieThis = null;
        }
        if (window._attPiePrev) {
            window._attPiePrev.destroy();
            window._attPiePrev = null;
        }

        const rThis = Math.min(100, Math.max(0, Number(data?.attendanceRate ?? 0)));
        const rPrev = (() => {
            if (data?.attendanceRatePrev != null)
                return Math.min(100, Math.max(0, Number(data.attendanceRatePrev)));
            const d = Number(data?.attendanceRateDeltaPct ?? 0);
            return Math.min(100, Math.max(0, rThis - d));
        })();

        const mkPie = (ctx, presentPct) =>
            new Chart(ctx, {
                type: "pie",
                data: {
                    labels: ["Có mặt", "Vắng"],
                    datasets: [
                        {
                            data: [presentPct, Math.max(0, 100 - presentPct)],
                            backgroundColor: ["#28a745", "#dc3545"],
                        },
                    ],
                },
                options: { responsive: true, plugins: { legend: { position: "bottom" } } },
            });

        window._attPieThis = mkPie(elThis, rThis);
        window._attPiePrev = mkPie(elPrev, rPrev);
    }, [data]);

    if (!isAdmin) {
        return (
            <>
                <section className="content-header">
                    <h1>Báo cáo & Thống kê</h1>
                    <ol className="breadcrumb">
                        <li>
                            <a href="#">
                                <i className="fa fa-dashboard" /> Trang chủ
                            </a>
                        </li>
                        <li className="active">Reports</li>
                    </ol>
                </section>
                <section className="content">
                    <div className="alert alert-danger">403 - Chỉ Admin được phép xem báo cáo.</div>
                </section>
            </>
        );
    }

    const { text: hvDeltaText, cls: hvDeltaCls } = deltaCountText(
        data?.newStudents,
        data?.newStudentsPrev
    );

    return (
        <div className="report-wrapper">
            {/* ==== CSS nội tuyến (giữ nguyên) ==== */}
            <style>{`
  .content-wrapper > .report-wrapper > .content-header,
  .content-wrapper > .report-wrapper > .content { padding-left:6px!important; padding-right:6px!important; }
  .content-wrapper > .report-wrapper .row { margin-left:0!important; margin-right:0!important; }
  .content-wrapper > .report-wrapper .row > [class^="col-"],
  .content-wrapper > .report-wrapper .row > [class*=" col-"] { padding-left:8px!important; padding-right:8px!important; }
  .kpi-box { transition: transform .15s ease, box-shadow .15s ease; border-radius:.6rem; }
  .kpi-box:hover { transform: translateY(-3px); box-shadow:0 6px 16px rgba(0,0,0,.18); }
  .kpi-value { font-weight:800; margin:0; line-height:1; }
  .kpi-title { font-weight:600; }
  .kpi-sub { margin-top:.25rem; }
  .kpi-icon { filter: drop-shadow(0 2px 3px rgba(0,0,0,.2)); }
  .chart-box canvas { max-height: 220px; }
  .chart-box--small canvas { max-height: 180px; }
  .row.equal-boxes { display:flex; flex-wrap:wrap; align-items:stretch; }
  .row.equal-boxes > [class*="col-"] { display:flex; }
  .row.equal-boxes .box { flex:1; display:flex; flex-direction:column; }
  .pie-wrap { display:flex; gap:12px; align-items:center; justify-content:space-between; }
  .pie-wrap .pie-one { flex:1 1 50%; min-width:0; }
`}</style>

            {/* ===== Header ===== */}
            <section className="content-header">
                <h1>Báo cáo & Thống kê</h1>
                <ol className="breadcrumb">
                    <li>
                        <a href="#">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </a>
                    </li>
                    <li className="active">Reports</li>
                </ol>
            </section>

            {/* ===== Content ===== */}
            <section className="content">
                {/* Bộ lọc tháng */}
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Bộ lọc</h3>
                    </div>
                    <div className="box-body">
                        <div className="form-inline">
                            <label className="mr-2">Chọn tháng: </label>
                            <input
                                type="month"
                                className="form-control"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                            {loading && (
                                <span className="ml-3 text-muted">
                                    <i className="fa fa-spinner fa-spin" /> Đang tải...
                                </span>
                            )}
                            {err && (
                                <span className="ml-3 text-danger">
                                    <i className="fa fa-exclamation-triangle" /> {err}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Đăng nhập theo ngày + KPI */}
                <div className="box">
                    <div
                        className="box-header with-border"
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <h3 className="box-title">Đăng nhập theo ngày (trong tháng)</h3>

                    </div>
                    <div className="box-body">
                        <div className="row" style={{ marginBottom: 12, display: "flex", alignItems: "stretch" }}>
                            <div className="col-lg-3 col-xs-6">
                                <div className="small-box bg-info">
                                    <div className="inner">
                                        <h3>{totalLoginsThis}</h3>
                                        <p>Đăng nhập tháng này (tới hôm nay)</p>
                                    </div>
                                    <div className="icon">
                                        <i className="ion ion-log-in" />
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-3 col-xs-6">
                                <div className="small-box bg-yellow">
                                    <div className="inner">
                                        <h3>{totalLoginsPrev}</h3>
                                        <p>Đăng nhập tháng trước</p>
                                    </div>
                                    <div className="icon">
                                        <i className="ion ion-clock" />
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-6 col-xs-6" style={{ display: "flex" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => {
                                            const { from, to } = ymToRange(month);
                                            setModalFrom(from);
                                            setModalTo(to);
                                            setModalFromText(isoToDMY(from));
                                            setModalToText(isoToDMY(to));
                                            setLoginModalOpen(true);
                                            loadLoginEvents(from, to);
                                        }}
                                    >
                                        <i className="fa fa-list-ul" /> Xem lượt đăng nhập trong tháng
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="box chart-box">
                            <div className="box-header with-border">
                                <h3 className="box-title">Giáo viên vs Học viên (mỗi ngày)</h3>
                            </div>
                            <div className="box-body">
                                <canvas id="loginByDayBar" height="160" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal: các lượt đăng nhập trong tháng (CÓ lọc ngày + phân trang) */}
                {loginModalOpen && (
                    <div>
                        <div className="modal fade in" style={{ display: "block" }}>
                            <div className="modal-dialog modal-lg">
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <button
                                            type="button"
                                            className="close"
                                            onClick={() => setLoginModalOpen(false)}
                                        >
                                            <span>×</span>
                                        </button>
                                        <h4 className="modal-title">Lượt đăng nhập trong tháng</h4>
                                    </div>

                                    <div className="modal-body">
                                        {/* Bộ lọc theo ngày */}
                                        {/* Bộ lọc theo ngày (text dd/MM/yyyy) */}
                                        <div className="form-inline" style={{ gap: 8, marginBottom: 10 }}>
                                            <label className="mr-2">Từ ngày:</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="dd/MM/yyyy"
                                                value={modalFromText}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                                    let out = digits;
                                                    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                                    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                                    setModalFromText(out);
                                                    const iso = dmyToISO(out);
                                                    if (iso) setModalFrom(iso);
                                                }}
                                                onBlur={() => {
                                                    const iso = dmyToISO(modalFromText);
                                                    if (iso) { setModalFrom(iso); setModalFromText(isoToDMY(iso)); }
                                                }}
                                                style={{ width: 140 }}
                                            />
                                            <span className="mx-2">→</span>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="dd/MM/yyyy"
                                                value={modalToText}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                                    let out = digits;
                                                    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                                    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                                    setModalToText(out);
                                                    const iso = dmyToISO(out);
                                                    if (iso) setModalTo(iso);
                                                }}
                                                onBlur={() => {
                                                    const iso = dmyToISO(modalToText);
                                                    if (iso) { setModalTo(iso); setModalToText(isoToDMY(iso)); }
                                                }}
                                                style={{ width: 140 }}
                                            />

                                            <button
                                                className="btn btn-default"
                                                onClick={() => loadLoginEvents(modalFrom, modalTo)}
                                                style={{ marginLeft: 8 }}
                                            >
                                                <i className="fa fa-search" /> Lọc
                                            </button>

                                            <button
                                                className="btn btn-link"
                                                onClick={() => {
                                                    const { from, to } = ymToRange(month);
                                                    setModalFrom(from); setModalTo(to);
                                                    setModalFromText(isoToDMY(from)); setModalToText(isoToDMY(to));
                                                    loadLoginEvents(from, to);
                                                }}
                                            >
                                                Đặt lại tháng này
                                            </button>
                                        </div>


                                        {/* Phân trang: chọn page size + điều hướng */}
                                        <div
                                            className="d-flex"
                                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
                                        >

                                            <div className="text-muted">
                                                {totalRows === 0
                                                    ? "Không có dữ liệu"
                                                    : `${startIdx + 1}–${endIdx} / ${totalRows}`}
                                            </div>

                                            <div>
                                                <button
                                                    className="btn btn-default btn-sm"
                                                    disabled={pageIndex <= 1}
                                                    onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                                                    style={{ marginRight: 6 }}
                                                >
                                                    ‹ Prev
                                                </button>
                                                <span className="text-muted" style={{ marginRight: 6 }}>
                                                    Page {pageIndex}/{totalPages}
                                                </span>
                                                <button
                                                    className="btn btn-default btn-sm"
                                                    disabled={pageIndex >= totalPages}
                                                    onClick={() =>
                                                        setPageIndex((p) => Math.min(totalPages, p + 1))
                                                    }
                                                >
                                                    Next ›
                                                </button>
                                            </div>
                                        </div>

                                        {loginEventsErr && (
                                            <div className="alert alert-danger">
                                                <i className="fa fa-exclamation-triangle" /> {loginEventsErr}
                                            </div>
                                        )}

                                        {loginEventsLoad ? (
                                            <div className="text-center text-muted">
                                                <i className="fa fa-spinner fa-spin" /> Đang tải…
                                            </div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-bordered table-hover">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: 160 }}>Thời gian (local)</th>
                                                            <th>Người dùng</th>
                                                            <th style={{ width: 110 }}>Role</th>
                                                            <th>Email</th>
                                                            <th style={{ width: 120 }}>IP</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pageRows.length === 0 && (
                                                            <tr>
                                                                <td colSpan="5" className="text-center text-muted">
                                                                    Không có dữ liệu
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {pageRows.map((e, idx) => (
                                                            <tr key={idx}>
                                                                <td>{fmtLocal(e.occurredAtLocal ?? e.occurredAtUtc)}</td>
                                                                <td>{getLoginName(e)}</td>
                                                                <td>{e.role}</td>
                                                                <td>{e.email}</td>
                                                                <td>{e.ip ?? "-"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            className="btn btn-default"
                                            onClick={() => setLoginModalOpen(false)}
                                        >
                                            Đóng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* backdrop */}
                        <div
                            className="modal-backdrop fade in"
                            onClick={() => setLoginModalOpen(false)}
                        />
                    </div>
                )}

                {/* ===== Tổng quan tháng (4 KPI) — GIỮ NGUYÊN ===== */}
                {data && (
                    <div className="box">
                        <div className="box-header with-border">
                            <h3 className="box-title">Tổng quan tháng</h3>
                        </div>
                        <div className="box-body">
                            <div className="row">
                                <Kpi
                                    color="bg-info"
                                    icon="fa-user-plus"
                                    title="HV đăng ký mới (tháng này)"
                                    value={num(data?.newStudents ?? 0, 0)}
                                    sub={<span className={hvDeltaCls}>{hvDeltaText}</span>}
                                />
                                <Kpi
                                    color="bg-success"
                                    icon="fa-check-circle"
                                    title="Tỉ lệ điểm danh TĐN"
                                    value={pct(data?.attendanceRate ?? 0, 1)}
                                    sub="So với tháng trước"
                                    deltaPct={data?.attendanceRateDeltaPct}
                                />
                                <Kpi
                                    color="bg-warning"
                                    icon="fa-calendar"
                                    title="Số buổi trong tháng"
                                    value={num(data?.sessionsThisMonth ?? 0, 0)}
                                    sub={`Hủy: ${num(data?.sessionsCanceled ?? 0, 0)} (${pct(
                                        data?.cancelRate ?? 0,
                                        1
                                    )})`}
                                />
                                <Kpi
                                    color="bg-danger"
                                    icon="fa-user-times"
                                    title="Rời lớp (so với tháng trước)"
                                    value={num(data?.leftStudents ?? 0, 0)}
                                    deltaPct={data?.leftStudentsDeltaPct}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== Hàng 1: Cột (số buổi) + Tròn (tỉ lệ điểm danh) — GIỮ NGUYÊN ===== */}
                {data && (
                    <div className="row equal-boxes">
                        <div className="col-lg-6">
                            <div className="box chart-box chart-box--small">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Số buổi trong tháng (hoàn thành / hủy)</h3>
                                </div>
                                <div className="box-body">
                                    <canvas id="sessionsBar" height="140" />
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="box chart-box chart-box--small">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Tỉ lệ điểm danh (tính đến hôm nay)</h3>
                                </div>
                                <div className="box-body">
                                    <div className="pie-wrap">
                                        <div className="pie-one text-center">
                                            <div className="text-muted mb-2">Tháng này</div>
                                            <canvas id="attPieThis" height="160" />
                                        </div>
                                        <div className="pie-one text-center">
                                            <div className="text-muted mb-2">Tháng trước</div>
                                            <canvas id="attPiePrev" height="160" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== Hàng 2: Đường theo ngày + Top lớp/giáo viên — GIỮ NGUYÊN ===== */}
                {data && (
                    <div className="row">
                        <div className="col-md-8">
                            <div className="box chart-box">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Tỉ lệ điểm danh theo ngày</h3>
                                </div>
                                <div className="box-body">
                                    <canvas id="attChart" height="160" />
                                </div>
                            </div>
                        </div>

                        <div className="col-md-4">
                            {/* Top lớp */}
                            <div className="box">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Top lớp theo tỉ lệ điểm danh</h3>
                                </div>
                                <div className="box-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-hover">
                                            <thead>
                                                <tr>
                                                    <th>Lớp</th>
                                                    <th className="text-right">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(data?.topClassesByAttendance ?? []).map((x, i) => (
                                                    <tr key={i}>
                                                        <td>{x?.name ?? "-"}</td>
                                                        <td className="text-right">{num(x?.value ?? 0, 1)}</td>
                                                    </tr>
                                                ))}
                                                {(data?.topClassesByAttendance ?? []).length === 0 && (
                                                    <tr>
                                                        <td colSpan="2" className="text-center text-muted">
                                                            Không có dữ liệu
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Top giáo viên */}
                            <div className="box">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Top giáo viên theo tỉ lệ điểm danh</h3>
                                </div>
                                <div className="box-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-hover">
                                            <thead>
                                                <tr>
                                                    <th>Giáo viên</th>
                                                    <th className="text-right">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(data?.topTeachersByAttendance ?? []).map((x, i) => (
                                                    <tr key={i}>
                                                        <td>{x?.name ?? "-"}</td>
                                                        <td className="text-right">{num(x?.value ?? 0, 1)}</td>
                                                    </tr>
                                                ))}
                                                {(data?.topTeachersByAttendance ?? []).length === 0 && (
                                                    <tr>
                                                        <td colSpan="2" className="text-center text-muted">
                                                            Không có dữ liệu
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
