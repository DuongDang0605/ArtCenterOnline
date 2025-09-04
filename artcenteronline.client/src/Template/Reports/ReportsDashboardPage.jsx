// src/Template/Reports/ReportsDashboardPage.jsx
import React, { useEffect, useState } from "react";
import { Chart } from "chart.js/auto";
import { getMonthlyOverview } from "../../api/reports";
import { readAuth } from "../../auth/authCore";

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

    // ===== Fetch =====
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
        return () => { alive = false; };
    }, [month, isAdmin]);

    // ===== Charts =====
    // 1) Biểu đồ đường theo ngày (attendance rate by day, this vs prev)
    useEffect(() => {
        if (!data) return;
        const el = document.getElementById("attChart");
        if (!el) return;

        if (window._attChart) { window._attChart.destroy(); window._attChart = null; }

        // --- số ngày của tháng được chọn ---
        const [yStr, mStr] = String((data?.month ?? month)).split("-");
        const y = Number(yStr), m = Number(mStr);
        const daysInMonth = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0).getDate() : 31;

        const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));

        // map series -> dict theo dayNumber
        const toDict = (ser = []) => {
            const d = {};
            for (const p of ser) {
                const day = Number(p?.label);
                const val = Number(p?.value);
                if (Number.isFinite(day) && day >= 1 && day <= 31 && Number.isFinite(val)) d[day] = val;
            }
            return d;
        };
        const dThis = toDict(data?.attendanceSeries ?? []);
        const dPrev = toDict(data?.attendanceSeriesPrev ?? []);

        // đủ độ dài theo số ngày của tháng
        const yThis = Array.from({ length: daysInMonth }, (_, i) => (dThis[i + 1] ?? NaN));
        const yPrev = Array.from({ length: daysInMonth }, (_, i) => (dPrev[i + 1] ?? NaN));

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
                            label: (item) => `${item.dataset.label}: ${Number(item.parsed.y).toFixed(1)}%`,
                        },
                    },
                },
                scales: {
                    y: { suggestedMin: 0, suggestedMax: 100, ticks: { callback: (v) => `${v}%` } },
                },
                interaction: { mode: "nearest", intersect: false },
            },
        });
    }, [data, month]);

    // 2) Biểu đồ cột: Số buổi trong tháng (hoàn thành / hủy) — tháng này và tháng trước
    useEffect(() => {
        if (!data) return;
        const el = document.getElementById("sessionsBar");
        if (!el) return;

        if (window._sessionsBar) { window._sessionsBar.destroy(); window._sessionsBar = null; }

        const doneThis = Number(data?.sessionsThisMonth ?? 0) - Number(data?.sessionsCanceled ?? 0);
        const cancelThis = Number(data?.sessionsCanceled ?? 0);

        const donePrev = Number(data?.sessionsThisMonthPrev ?? 0) - Number(data?.sessionsCanceledPrev ?? 0);
        const cancelPrev = Number(data?.sessionsCanceledPrev ?? 0);

        window._sessionsBar = new Chart(el, {
            type: "bar",
            data: {
                labels: ["Tháng này", "Tháng trước"],
                datasets: [
                    { label: "Hoàn thành", data: [Math.max(0, doneThis), Math.max(0, donePrev)], backgroundColor: "#17a2b8" },
                    { label: "Hủy", data: [Math.max(0, cancelThis), Math.max(0, cancelPrev)], backgroundColor: "#ffc107" },
                ],
            },
            options: {
                responsive: true,
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            },
        });
    }, [data]);

    // 3) Biểu đồ tròn: tỉ lệ điểm danh (This/Prev) — 2 pies đặt cạnh nhau
    useEffect(() => {
        if (!data) return;
        const elThis = document.getElementById("attPieThis");
        const elPrev = document.getElementById("attPiePrev");
        if (!elThis || !elPrev) return;

        if (window._attPieThis) { window._attPieThis.destroy(); window._attPieThis = null; }
        if (window._attPiePrev) { window._attPiePrev.destroy(); window._attPiePrev = null; }

        // Cố gắng lấy % từ BE; nếu không có, dùng delta để suy ra; cuối cùng fallback 0
        const rThis = Math.min(100, Math.max(0, Number(data?.attendanceRate ?? 0)));
        const rPrev = (() => {
            if (data?.attendanceRatePrev != null) return Math.min(100, Math.max(0, Number(data.attendanceRatePrev)));
            const d = Number(data?.attendanceRateDeltaPct ?? 0);
            return Math.min(100, Math.max(0, rThis - d));
        })();

        const mkPie = (ctx, presentPct) =>
            new Chart(ctx, {
                type: "pie",
                data: {
                    labels: ["Có mặt", "Vắng"],
                    datasets: [{
                        data: [presentPct, Math.max(0, 100 - presentPct)],
                        backgroundColor: ["#28a745", "#dc3545"],
                    }],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: "bottom" } },
                },
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
                        <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                        <li className="active">Reports</li>
                    </ol>
                </section>
                <section className="content">
                    <div className="alert alert-danger">403 - Chỉ Admin được phép xem báo cáo.</div>
                </section>
            </>
        );
    }

    const { text: hvDeltaText, cls: hvDeltaCls } =
        deltaCountText(data?.newStudents, data?.newStudentsPrev);

    return (
        <div className="report-wrapper">
            {/* ==== CSS nội tuyến ==== */}
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

  /* Thu nhỏ box biểu đồ để nằm 1 hàng gọn gàng */
  .chart-box canvas { max-height: 220px; }
  .chart-box--small canvas { max-height: 180px; }

  /* Hai box cột và tròn trong cùng 1 hàng: luôn cao bằng nhau */
  .row.equal-boxes { display:flex; flex-wrap:wrap; align-items:stretch; }
  .row.equal-boxes > [class*="col-"] { display:flex; }
  .row.equal-boxes .box { flex:1; display:flex; flex-direction:column; }

  /* Hai pie đặt cạnh nhau trong cùng box */
  .pie-wrap { display:flex; gap:12px; align-items:center; justify-content:space-between; }
  .pie-wrap .pie-one { flex:1 1 50%; min-width:0; }
`}</style>


            {/* ===== Header ===== */}
            <section className="content-header">
                <h1>Báo cáo & Thống kê</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
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
                            {loading && <span className="ml-3 text-muted"><i className="fa fa-spinner fa-spin" /> Đang tải...</span>}
                            {err && <span className="ml-3 text-danger"><i className="fa fa-exclamation-triangle" /> {err}</span>}
                        </div>
                    </div>
                </div>

                {/* Tổng quan tháng (4 KPI) */}
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
                                    sub={`Hủy: ${num(data?.sessionsCanceled ?? 0, 0)} (${pct(data?.cancelRate ?? 0, 1)})`}
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

                {/* ===== Hàng 1: Cột (số buổi) + Tròn (tỉ lệ điểm danh) ===== */}
                {data && (
                    <div className="row equal-boxes">
                        {/* Biểu đồ cột */}
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

                        {/* Biểu đồ tròn (2 cái trong 1 box) */}
                        <div className="col-lg-6">
                            <div className="box chart-box chart-box--small">
                                <div className="box-header with-border">
                                    <h3 className="box-title">Tỉ lệ điểm danh (cả tháng)</h3>
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

                {/* ===== Hàng 2: Đường theo ngày + Top lớp/giáo viên ===== */}
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
                                                        <td colSpan="2" className="text-center text-muted">Không có dữ liệu</td>
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
                                                        <td colSpan="2" className="text-center text-muted">Không có dữ liệu</td>
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
