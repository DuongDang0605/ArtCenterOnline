// src/Template/Teacher/EditTeacherPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTeacher, updateTeacher } from "./teachers";

// 🔁 Đồng bộ theo AddClassPage:
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function EditTeacherPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showError, showSuccess, Toasts } = useToasts();

    const [form, setForm] = useState({
        TeacherId: Number(id),
        UserId: 0,
        Email: "",
        TeacherName: "",
        PhoneNumber: "",
        status: 1,
        Password: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal xác nhận (giống AddClassPage)
    const [confirmOpen, setConfirmOpen] = useState(false);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getTeacher(id);
                if (!alive) return;
                setForm((f) => ({
                    ...f,
                    TeacherId: Number(data?.teacherId ?? data?.TeacherId ?? id),
                    UserId: Number(data?.userId ?? data?.UserId ?? 0),
                    Email: String(data?.userEmail ?? data?.email ?? data?.Email ?? ""),
                    TeacherName: String(data?.teacherName ?? data?.TeacherName ?? ""),
                    PhoneNumber: String(data?.phoneNumber ?? data?.PhoneNumber ?? ""),
                    status: Number(data?.status ?? data?.Status ?? 1),
                    Password: "",
                }));
            } catch (e) {
                showError(extractErr(e) || "Không tải được dữ liệu giáo viên.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    function validate() {
        if (!String(form.TeacherName || "").trim()) return "Vui lòng nhập Tên giáo viên.";
        if (!String(form.PhoneNumber || "").trim()) return "Vui lòng nhập Số điện thoại.";
        // Email & Password là tuỳ chọn khi sửa
        return "";
    }

    function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) { showError(v); return; }
        setConfirmOpen(true); // mở modal xác nhận
    }

    async function doUpdate() {
        const v = validate();
        if (v) { showError(v); return; }

        setSaving(true);
        try {
            await updateTeacher(form.TeacherId, {
                TeacherId: form.TeacherId,
                UserId: form.UserId,
                Email: form.Email?.trim() || undefined,
                Password: form.Password || undefined, // optional
                TeacherName: form.TeacherName?.trim() || "",
                PhoneNumber: form.PhoneNumber?.trim() || "",
                status: Number(form.status),
            });
            // Điều hướng về danh sách kèm notice để trang đích show toast success
            navigate("/teachers", { state: { notice: "Đã cập nhật giáo viên." } });
            // Nếu muốn hiển thị ngay tại trang này, có thể bật:
            // showSuccess("Đã cập nhật giáo viên.");
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra khi lưu.");
        } finally {
            setSaving(false);
            setConfirmOpen(false);
        }
    }

    if (loading) {
        return (
            <>
                <section className="content">
                    <p className="text-muted">Đang tải…</p>
                </section>
                <Toasts />
            </>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>SỬA GIÁO VIÊN</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/teachers">Giáo viên</Link></li>
                    <li className="active">Sửa</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-12 col-lg-12">
                        <div className="box box-primary">
                            <div className="box-body">
                                <form onSubmit={onSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="Email">Email (tuỳ chọn)</label>
                                        <input
                                            id="Email"
                                            className="form-control"
                                            type="email"
                                            value={form.Email}
                                            onChange={(e) => setField("Email", e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="Password">Đổi mật khẩu (tuỳ chọn)</label>
                                        <input
                                            id="Password"
                                            className="form-control"
                                            type="password"
                                            value={form.Password}
                                            onChange={(e) => setField("Password", e.target.value)}
                                            placeholder="Để trống nếu không đổi"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="TeacherName">Tên giáo viên</label>
                                        <input
                                            id="TeacherName"
                                            className="form-control"
                                            type="text"
                                            value={form.TeacherName}
                                            onChange={(e) => setField("TeacherName", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input
                                            id="PhoneNumber"
                                            className="form-control"
                                            type="tel"
                                            value={form.PhoneNumber}
                                            onChange={(e) => setField("PhoneNumber", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="status">Trạng thái</label>
                                        <select
                                            id="status"
                                            className="form-control"
                                            value={form.status}
                                            onChange={(e) => setField("status", Number(e.target.value))}
                                        >
                                            <option value={1}>Đang dạy</option>
                                            <option value={0}>Ngừng dạy</option>
                                        </select>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>{" "}
                                    <Link to="/teachers" className="btn btn-default">Hủy</Link>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal xác nhận ở giữa màn hình, tiêu đề in đậm (đồng bộ AddClassPage) */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận cập nhật giáo viên"
                message={`Lưu thay đổi cho "${(form.TeacherName || "").trim() || "giáo viên"}"?`}
                details="Bạn có thể chỉnh sửa lại sau nếu cần."
                confirmText="Lưu thay đổi"
                cancelText="Xem lại"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doUpdate}
                busy={saving}
            />

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
