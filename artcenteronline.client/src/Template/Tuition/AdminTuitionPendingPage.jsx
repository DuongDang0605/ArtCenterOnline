// src/Template/Tuition/AdminTuitionPendingPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminListTuitionRequests } from "../../api/tuition";

/** Gom message từ BE giống Schedule */
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

export default function AdminTuitionPendingPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Toast lỗi
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

    // Toast success khi quay về từ trang duyệt/từ chối
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
            const { data } = await adminListTuitionRequests("Pending");
            setRows(data || []);
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

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
                <h1>Quản lý nộp học phí — Chờ duyệt</h1>
            </section>
            <section className="content">
                <div className="box">
                    <div className="box-body table-responsive">
                        {loading ? (
                            <div className="p-3">Đang tải…</div>
                        ) : rows.length === 0 ? (
                            <div className="p-3">Không có yêu cầu chờ duyệt.</div>
                        ) : (
                            <table className="table table-bordered table-hover">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Học viên</th>
                                        <th>Email</th>
                                        <th>Ngày gửi</th>
                                        <th>Trạng thái</th>
                                        <th>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.id}>
                                            <td>{i + 1}</td>
                                            <td>{r.studentName}</td>
                                            <td>{r.email}</td>
                                            <td>{fmt(r.createdAtUtc)}</td>
                                            <td><span className="label label-warning">Chờ duyệt</span></td>
                                            <td>
                                                <Link className="btn btn-xs btn-primary" to={`/admin/tuition/requests/${r.id}`}>
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
