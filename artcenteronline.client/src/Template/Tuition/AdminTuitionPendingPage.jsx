// src/Template/Tuition/AdminTuitionPendingPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminListTuitionRequests } from "../../api/tuition";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

function fmt(dt) {
    if (!dt) return "";
    return new Date(dt).toLocaleString("vi-VN", { hour12: false });
}

export default function AdminTuitionPendingPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Toasts đồng bộ (success + error)
    const { showError, showSuccess, Toasts } = useToasts();
    const location = useLocation();
    const navigate = useNavigate();

    // Hiển thị notice khi điều hướng từ trang chi tiết/duyệt/từ chối
    useEffect(() => {
        const notice = location.state?.notice;
        if (notice) {
            showSuccess(notice);
            // xóa state để F5 không lặp lại
            navigate(".", { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        try {
            const { data } = await adminListTuitionRequests("Pending");
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra.");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []); // mount

    return (
        <>
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

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
