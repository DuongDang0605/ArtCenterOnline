// src/Template/Tuition/NewTuitionRequestPage.jsx
import { useEffect, useState } from "react";
import { createTuitionRequest } from "../../api/tuition";
import { useNavigate, Link } from "react-router-dom";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function NewTuitionRequestPage() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Toasts đồng bộ hệ thống (success + error)
    const { showError, showSuccess, Toasts } = useToasts();

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
            // điều hướng về danh sách, trang đích sẽ hiển thị success từ notice
            navigate("/student/tuition/requests", {
                state: { notice: "Đã gửi yêu cầu. Vui lòng chờ duyệt." },
                replace: true,
            });
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra khi gửi yêu cầu.");
        } finally {
            setBusy(false);
            setConfirmOpen(false);
        }
    }

    // dọn URL blob khi rời trang / đổi ảnh
    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

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
                                <input
                                    type="file"
                                    className="form-control"
                                    accept="image/*"
                                    onChange={onPick}
                                />
                            </div>

                            {preview && (
                                <div className="form-group">
                                    <label>Preview</label>
                                    <div>
                                        <img
                                            src={preview}
                                            alt="preview"
                                            style={{
                                                width: 320,
                                                height: 480,
                                                objectFit: "contain",
                                                borderRadius: 6,
                                                border: "1px solid #ccc",
                                                backgroundColor: "#f9f9f9",
                                            }}
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

            {/* Modal xác nhận gửi — đồng bộ ConfirmDialog */}
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

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
