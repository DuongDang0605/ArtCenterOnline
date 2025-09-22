// src/Template/Tuition/NewTuitionRequestPage.jsx
import { useEffect, useState } from "react";
import { createTuitionRequest } from "../../api/tuition";
import { useNavigate, Link } from "react-router-dom";
import ConfirmDialog from "../../component/ConfirmDialog";

/** Đồng nhất format lỗi như bên Schedule */
function extractErr(e) {
    const r = e?.response;
    return (
        r?.data?.message ||
        r?.data?.detail ||
        r?.data?.title ||
        (typeof r?.data === "string" ? r.data : null) ||
        e?.message ||
        "Có lỗi xảy ra khi gửi yêu cầu."
    );
}

export default function NewTuitionRequestPage() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [busy, setBusy] = useState(false);

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

    // Modal xác nhận
    const [confirmOpen, setConfirmOpen] = useState(false);

    const navigate = useNavigate();

    function onPick(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/image\/(jpeg|jpg|png)/i.test(f.type)) {
            showError("Chỉ chấp nhận ảnh JPG/PNG.");
            e.target.value = "";
            return;
        }
        if (f.size > 5_000_000) {
            showError("Ảnh vượt quá 5MB.");
            e.target.value = "";
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    function onSubmit(e) {
        e.preventDefault();
        if (!file) {
            showError("Vui lòng chọn ảnh.");
            return;
        }
        setConfirmOpen(true);
    }

    async function doSubmit() {
        setBusy(true);
        try {
            await createTuitionRequest(file);
            navigate("/student/tuition/requests", {
                state: { notice: "Đã gửi yêu cầu. Vui lòng chờ duyệt." },
                replace: true,
            });
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setBusy(false);
            setConfirmOpen(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Đóng tiền học — Tạo yêu cầu mới</h1>
            </section>
            <section className="content">
                <div className="box">
                    <form onSubmit={onSubmit}>
                        <div className="box-body">
                            <div className="form-group">
                                <label>Ảnh minh chứng (JPG/PNG, ≤ 5MB)</label>
                                <input type="file" className="form-control" accept="image/*" onChange={onPick} />
                            </div>
                            {preview && (
                                <div className="form-group">
                                    <label>Preview</label>
                                    <div>
                                        <img
                                            src={preview}
                                            alt="preview"
                                            style={{ maxWidth: 320, borderRadius: 6, border: "1px solid #ccc" }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="box-footer">
                            <button className="btn btn-primary" disabled={busy}>
                                <i className="fa fa-paper-plane" /> Gửi yêu cầu
                            </button>{" "}
                            <Link to="/student/tuition/requests" className="btn btn-default">
                                Hủy
                            </Link>
                        </div>
                    </form>
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

            {/* Modal xác nhận gửi — đẹp hơn */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận nộp học phí"
                message="Bạn có chắc chắn muốn gửi yêu cầu đóng tiền học?"
                confirmText="Gửi yêu cầu"
                cancelText="Xem lại"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doSubmit}
                busy={busy}
            />

        </>
    );
}
