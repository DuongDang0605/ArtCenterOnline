// src/Template/Tuition/AdminTuitionHistoryPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminListTuitionRequests } from "../../api/tuition";

/** Giống Schedule: gom message từ BE */
function extractErr(e) {
    const r = e?.response;
    return (
        r?.data?.message ||
        r?.data?.detail ||
        r?.data?.title ||
        (typeof r?.data === "string" ? r.data : null) ||
        e?.message ||
        "Có lỗi xảy ra."
    );
}

function fmt(dt) {
    if (!dt) return "";
    return new Date(dt).toLocaleString("vi-VN", { hour12: false });
}

const STATUS_OPTIONS = [
    { value: "notpending", text: "Tất cả" },
    { value: "Approved", text: "Đã duyệt" },
    { value: "Rejected", text: "Từ chối" },
    { value: "Canceled", text: "Tự hủy" },
];

function badge(s) {
    if (s === "Approved") return <span className="label label-success">Đã duyệt</span>;
    if (s === "Rejected") return <span className="label label-danger">Từ chối</span>;
    if (s === "Canceled") return <span className="label label-default">Tự hủy</span>;
    if (s === "Pending") return <span className="label label-warning">Chờ duyệt</span>;
    return s;
}

export default function AdminTuitionHistoryPage() {
    const [rows, setRows] = useState([]);
    const [status, setStatus] = useState("notpending");
    const [loading, setLoading] = useState(true);

    // Toast lỗi (tự ẩn)
    const AUTO_DISMISS = 5000;
    const [err, setErr] = useState("");
    const [remaining, setRemaining] = useState(0);
    function showError(msg) {
        const t = String(msg || "");
        setErr(t);
        if (t) setRemaining(AUTO_DISMISS);
    }
    useEffect(() => {
        if (!err) return;
        const started = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - started));
            setRemaining(left);
            if (left === 0) setErr("");
        }, 100);
        return () => clearInterval(iv);
    }, [err]);

    // Toast success khi điều hướng về từ trang chi tiết
    const location = useLocation();
    const navigate = useNavigate();
    const [notice, setNotice] = useState(location.state?.notice || "");
    useEffect(() => {
        if (location.state?.notice) {
            setTimeout(() => navigate(".", { replace: true, state: {} }), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    async function load() {
        setLoading(true);
        try {
            const { data } = await adminListTuitionRequests(status);
            setRows(data || []);
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

    return (
        <>
            {/* Toast success */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")}><span aria-hidden="true">&times;</span></button>
                    {notice}
                </div>
            )}

            <section className="content-header">
                <h1>Quản lý nộp học phí — Lịch sử</h1>
            </section>
            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <div className="form-inline">
                            <label>Trạng thái:&nbsp;</label>
                            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                                {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.text}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="box-body table-responsive">
                        {loading ? (
                            <div className="p-3">Đang tải…</div>
                        ) : rows.length === 0 ? (
                            <div className="p-3">Không có bản ghi.</div>
                        ) : (
                            <table className="table table-bordered table-hover">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Học viên</th>
                                        <th>Email</th>
                                        <th>Ngày gửi</th>
                                        <th>Trạng thái</th>
                                        <th>Ngày xử lý</th>
                                        <th>Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.id}>
                                            <td>{i + 1}</td>
                                            <td>{r.studentName}</td>
                                            <td>{r.email}</td>
                                            <td>{fmt(r.createdAtUtc)}</td>
                                            <td>{badge(r.status)}</td>
                                            <td>{fmt(r.reviewedAtUtc)}</td>
                                            <td>
                                                <Link className="btn btn-xs btn-default" to={`/admin/tuition/requests/${r.id}`}>
                                                    <i className="fa fa-eye" /> Xem
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>

            {/* Toast lỗi */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setErr("")}><span aria-hidden="true">&times;</span></button>
                    {err}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Tự ẩn sau {(remaining / 1000).toFixed(1)}s</div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div style={{ height: "100%", width: `${(remaining / AUTO_DISMISS) * 100}%`, background: "#a94442", transition: "width 100ms linear" }} />
                    </div>
                </div>
            )}
        </>
    );
}
