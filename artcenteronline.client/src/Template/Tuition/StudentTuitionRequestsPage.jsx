// src/Template/Tuition/StudentTuitionRequestsPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import http from "../../api/http";
import { cancelMyTuitionRequest, getMyTuitionRequests } from "../../api/tuition";
import ConfirmDialog from "../../component/ConfirmDialog";

/** Đồng bộ format lỗi như bên Schedule */
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

export default function StudentTuitionRequestsPage() {
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
        const startedAt = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - startedAt));
            setRemaining(left);
            if (left === 0) setErr("");
        }, 100);
        return () => clearInterval(iv);
    }, [err]);

    // Toast thành công
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
            const { data } = await getMyTuitionRequests();
            setRows(data || []);
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    // Modal xác nhận hủy
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelTargetId, setCancelTargetId] = useState(null);
    const [cancelBusy, setCancelBusy] = useState(false);

    function askCancel(id) {
        setCancelTargetId(id);
        setConfirmOpen(true);
    }

    async function doCancel() {
        if (!cancelTargetId) return;
        setCancelBusy(true);
        try {
            await cancelMyTuitionRequest(cancelTargetId);
            setNotice("Đã hủy yêu cầu.");
            await load();
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setCancelBusy(false);
            setConfirmOpen(false);
            setCancelTargetId(null);
        }
    }

    // >>> Cách A: tải ảnh qua axios (có Authorization), rồi mở bằng blob
    async function openImage(id) {
        try {
            const res = await http.get(`/tuitionrequests/${id}/image`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            window.open(url, "_blank");
        } catch (e) {
            const msg = e?.response?.status === 401 ? "Bạn cần đăng nhập để xem ảnh." : extractErr(e);
            showError(msg);
        }
    }

    return (
        <>
            {/* Toast thành công */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            <section className="content-header">
                <h1>Đóng tiền học — Lịch sử yêu cầu</h1>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <Link className="btn btn-primary" to="/student/tuition/new-request">
                            <i className="fa fa-plus" /> Tạo yêu cầu mới
                        </Link>
                    </div>
                    <div className="box-body table-responsive">
                        {loading ? (
                            <div className="p-3">Đang tải…</div>
                        ) : rows.length === 0 ? (
                            <div className="p-3">Chưa có yêu cầu nào.</div>
                        ) : (
                            <table className="table table-bordered table-hover">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Email</th>
                                        <th>Ngày gửi</th>
                                        <th>Trạng thái</th>
                                        <th>Ngày xử lý</th>
                                        <th>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.id}>
                                            <td>{i + 1}</td>
                                            <td>{r.email}</td>
                                            <td>{fmt(r.createdAtUtc)}</td>
                                            <td>
                                                {r.status === "Pending" && <span className="label label-warning">Chờ duyệt</span>}
                                                {r.status === "Approved" && <span className="label label-success">Đã duyệt</span>}
                                                {r.status === "Rejected" && <span className="label label-danger">Từ chối</span>}
                                                {r.status === "Canceled" && <span className="label label-default">Tự hủy</span>}
                                            </td>
                                            <td>{fmt(r.reviewedAtUtc)}</td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                <button className="btn btn-xs btn-default" onClick={() => openImage(r.id)}>
                                                    <i className="fa fa-download" /> Tải ảnh
                                                </button>{" "}
                                                {r.status === "Pending" && (
                                                    <button className="btn btn-xs btn-danger" onClick={() => askCancel(r.id)}>
                                                        <i className="fa fa-times" /> Hủy
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>

            {/* Toast lỗi nổi */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setErr("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {err}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(remaining / 1000).toFixed(1)}s
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{ height: "100%", width: `${(remaining / AUTO_DISMISS) * 100}%`, background: "#a94442", transition: "width 100ms linear" }}
                        />
                    </div>
                </div>
            )}

            {/* Modal xác nhận hủy — đẹp hơn */}
            <ConfirmDialog
                open={confirmOpen}
                type="danger"
                title="Xác nhận hủy yêu cầu"
                message="Bạn có chắc chắn muốn hủy yêu cầu đang chờ duyệt?"
                confirmText="Hủy yêu cầu"
                cancelText="Để sau"
                onCancel={() => {
                    if (!cancelBusy) {
                        setConfirmOpen(false);
                        setCancelTargetId(null);
                    }
                }}
                onConfirm={doCancel}
                busy={cancelBusy}
            />

        </>
    );
}
