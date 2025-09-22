// src/Template/Tuition/AdminTuitionRequestDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import http from "../../api/http";
import { adminApproveTuitionRequest, adminGetTuitionRequest, adminRejectTuitionRequest } from "../../api/tuition";
import ConfirmDialog from "../../component/ConfirmDialog";

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

export default function AdminTuitionRequestDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState(1);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

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

    async function load() {
        setLoading(true);
        try {
            const { data } = await adminGetTuitionRequest(id);
            setItem(data);

            // tải ảnh (có Authorization) để xem inline
            try {
                const res = await http.get(`/tuitionrequests/${id}/image`, { responseType: "blob" });
                const url = URL.createObjectURL(res.data);
                setPreviewUrl(url);
            } catch (e) {
                console.warn("Preview image failed", e);
            }
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
        // eslint-disable-next-line
    }, [id]);

    async function downloadOriginal() {
        try {
            const res = await http.get(`/tuitionrequests/${item.id}/image`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `tuition_${item.id}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            showError(extractErr(e));
        }
    }

    // ===== Modal xác nhận =====
    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);

    function askApprove() {
        // validate trước khi mở confirm
        if (!(sessions >= 1 && sessions <= 200)) {
            showError("Số buổi phải từ 1 đến 200.");
            return;
        }
        setApproveOpen(true);
    }

    async function doApprove() {
        setBusy(true);
        try {
            await adminApproveTuitionRequest(item.id, sessions);
            // Điều hướng về Pending với toast success
            navigate("/admin/tuition/pending", { state: { notice: `Đã duyệt và cộng ${sessions} buổi.` }, replace: true });
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setBusy(false);
            setApproveOpen(false);
        }
    }

    function askReject() {
        setRejectOpen(true);
    }

    async function doReject() {
        setBusy(true);
        try {
            await adminRejectTuitionRequest(item.id, reason || null);
            navigate("/admin/tuition/pending", { state: { notice: "Đã từ chối yêu cầu." }, replace: true });
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setBusy(false);
            setRejectOpen(false);
        }
    }

    if (loading) {
        return (
            <>
                <section className="content-header"><h1>Đang tải…</h1></section>
            </>
        );
    }

    if (!item) {
        return (
            <>
                <section className="content-header"><h1>Không tìm thấy yêu cầu</h1></section>
                <section className="content"><Link to="/admin/tuition/pending" className="btn btn-default">Quay lại</Link></section>
            </>
        );
    }

    const isPending = item.status === "Pending";

    return (
        <>
            <section className="content-header">
                <h1>Yêu cầu nộp học phí #{item.id} — {item.status}</h1>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-md-7">
                        <div className="box">
                            <div className="box-header with-border"><h3 className="box-title">Thông tin yêu cầu</h3></div>
                            <div className="box-body">
                                <p><b>Học viên:</b> {item.studentName} (ID: {item.studentId})</p>
                                <p><b>Email:</b> {item.email}</p>
                                <p><b>Ngày gửi:</b> {fmt(item.createdAtUtc)}</p>
                                <p><b>Ngày xử lý:</b> {fmt(item.reviewedAtUtc)}</p>
                                {item.rejectReason && <p><b>Lý do từ chối:</b> {item.rejectReason}</p>}
                            </div>
                            <div className="box-footer">
                                <Link to="/admin/tuition/pending" className="btn btn-default">Quay lại</Link>
                            </div>
                        </div>

                        {isPending && (
                            <div className="box">
                                <div className="box-header with-border"><h3 className="box-title">Duyệt yêu cầu</h3></div>
                                <div className="box-body">
                                    <div className="row">
                                        <div className="col-sm-6">
                                            <div className="form-group">
                                                <label>Số buổi cộng thêm (1–200)</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    min={1}
                                                    max={200}
                                                    value={sessions}
                                                    onChange={(e) => setSessions(parseInt(e.target.value || "0", 10))}
                                                />
                                            </div>
                                            <button className="btn btn-success" disabled={busy} onClick={askApprove}>
                                                <i className="fa fa-check" /> Đồng ý
                                            </button>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="form-group">
                                                <label>Lý do từ chối (tuỳ chọn)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    maxLength={300}
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                />
                                            </div>
                                            <button className="btn btn-danger" disabled={busy} onClick={askReject}>
                                                <i className="fa fa-times" /> Từ chối
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="col-md-5">
                        <div className="box">
                            <div className="box-header with-border"><h3 className="box-title">Ảnh minh chứng</h3></div>
                            <div className="box-body">
                                {previewUrl ? (
                                    <>
                                        <div style={{ marginBottom: 12 }}>
                                            <img
                                                src={previewUrl}
                                                alt="tuition-proof"
                                                style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid #ddd" }}
                                            />
                                        </div>
                                        <button className="btn btn-default" onClick={downloadOriginal}>
                                            <i className="fa fa-download" /> Tải ảnh gốc
                                        </button>
                                    </>
                                ) : (
                                    <div>Không có ảnh.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Toast lỗi (nếu có) */}
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

            {/* Modal xác nhận DUYỆT */}
            <ConfirmDialog
                open={approveOpen}
                type="success"
                title="Xác nhận duyệt yêu cầu"
                message={`Bạn có chắc chắn duyệt và cộng ${sessions} buổi cho học viên?`}
                confirmText="Duyệt"
                cancelText="Xem lại"
                onCancel={() => setApproveOpen(false)}
                onConfirm={doApprove}
                busy={busy}
            />

            {/* Modal xác nhận TỪ CHỐI */}
            <ConfirmDialog
                open={rejectOpen}
                type="danger"
                title="Xác nhận từ chối"
                message="Bạn có chắc chắn muốn từ chối yêu cầu này?"
                details={reason ? `Lý do: ${reason}` : "Bạn có thể bổ sung lý do trước khi xác nhận."}
                confirmText="Từ chối"
                cancelText="Quay lại"
                onCancel={() => setRejectOpen(false)}
                onConfirm={doReject}
                busy={busy}
            />
        </>
    );
}
