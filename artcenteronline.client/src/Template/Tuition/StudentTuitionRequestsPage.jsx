// src/Template/Tuition/StudentTuitionRequestsPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import http from "../../api/http";
import { cancelMyTuitionRequest, getMyTuitionRequests } from "../../api/tuition";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

function fmt(dt) {
    if (!dt) return "";
    return new Date(dt).toLocaleString("vi-VN", { hour12: false });
}

export default function StudentTuitionRequestsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Hệ thống Toasts đồng bộ
    const { showError, showSuccess, Toasts } = useToasts();
    const location = useLocation();
    const navigate = useNavigate();

    // Nhận notice từ trang tạo yêu cầu, hiển thị toast success rồi clear state
    useEffect(() => {
        const notice = location.state?.notice;
        if (notice) {
            showSuccess(notice);
            navigate(".", { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        try {
            const { data } = await getMyTuitionRequests();
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra.");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

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
            showSuccess("Đã hủy yêu cầu.");
            await load();
        } catch (e) {
            showError(extractErr(e) || "Hủy yêu cầu thất bại.");
        } finally {
            setCancelBusy(false);
            setConfirmOpen(false);
            setCancelTargetId(null);
        }
    }

    // Tải ảnh qua axios (có Authorization), mở blob
    async function openImage(id) {
        try {
            const res = await http.get(`/tuitionrequests/${id}/image`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            window.open(url, "_blank");
        } catch (e) {
            const msg = e?.response?.status === 401 ? "Bạn cần đăng nhập để xem ảnh." : (extractErr(e) || "Không tải được ảnh.");
            showError(msg);
        }
    }

    return (
        <>
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
                                        <th>Lý do từ chối</th> 
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
                                            <td>{r.rejectReason || ""}</td>
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

            {/* Modal xác nhận hủy — đồng bộ ConfirmDialog */}
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

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
