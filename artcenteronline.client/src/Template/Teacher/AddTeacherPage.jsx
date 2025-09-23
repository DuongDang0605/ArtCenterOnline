// src/Template/Teacher/AddTeacherPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTeacher } from "./teachers";

// 🔁 Đồng bộ theo AddClassPage:
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function AddTeacherPage() {
    const navigate = useNavigate();
    const { showError, showSuccess, Toasts } = useToasts();

    const [form, setForm] = useState({
        Email: "",
        Password: "",
        TeacherName: "",
        PhoneNumber: "",
        status: 1,
    });
    const [saving, setSaving] = useState(false);

    // Modal xác nhận tạo mới
    const [confirmOpen, setConfirmOpen] = useState(false);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // ===== Realtime validation (giữ logic gốc) =====
    const email = (form.Email || "").trim();
    const emailInvalid = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const pw = String(form.Password || "");
    const pwTooShort = pw.length > 0 && pw.length < 6;

    function fgClass(error, success) {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    }

    function validate() {
        if (!email) return "Vui lòng nhập Email.";
        if (emailInvalid) return "Email không hợp lệ.";
        if (!pw || pw.length < 6) return "Mật khẩu phải ít nhất 6 ký tự.";
        if (!String(form.TeacherName || "").trim()) return "Vui lòng nhập Tên giáo viên.";
        if (!String(form.PhoneNumber || "").trim()) return "Vui lòng nhập Số điện thoại.";
        return "";
    }

    const formInvalid =
        !email ||
        emailInvalid ||
        !pw ||
        pwTooShort ||
        !String(form.TeacherName || "").trim() ||
        !String(form.PhoneNumber || "").trim();

    function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) { showError(v); return; }
        setConfirmOpen(true); // mở xác nhận giống AddClassPage
    }

    async function doCreate() {
        const v = validate();
        if (v) { showError(v); return; }

        setSaving(true);
        try {
            await createTeacher({
                Email: email,
                Password: form.Password,
                TeacherName: form.TeacherName.trim(),
                PhoneNumber: form.PhoneNumber.trim(),
                status: Number(form.status),
            });
            // Điều hướng và để trang đích hiển thị success (pattern đồng bộ)
            navigate("/teachers", { state: { notice: "Đã thêm giáo viên mới." } });
            // Nếu muốn hiện toast ngay tại trang này, có thể bật:
            // showSuccess("Đã thêm giáo viên mới.");
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra.");
        } finally {
            setSaving(false);
            setConfirmOpen(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>THÊM GIÁO VIÊN</h1>
                <ol className="breadcrumb">
                    <li>
                        <Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link>
                    </li>
                    <li>
                        <Link to="/teachers">Giáo viên</Link>
                    </li>
                    <li className="active">Thêm mới</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-12 col-lg-12">
                        <div className="box box-primary">
                            <div className="box-body">
                                <form onSubmit={onSubmit}>
                                    <div className={fgClass(email && emailInvalid, email && !emailInvalid)}>
                                        <label htmlFor="Email">Email</label>
                                        <input
                                            id="Email"
                                            className="form-control"
                                            type="email"
                                            value={form.Email}
                                            onChange={(e) => setField("Email", e.target.value)}
                                            required
                                        />
                                        {email && emailInvalid && (
                                            <p className="help-block">Email không đúng định dạng</p>
                                        )}
                                        {email && !emailInvalid && (
                                            <p className="help-block text-green">Email đúng định dạng</p>
                                        )}
                                    </div>

                                    <div className={fgClass(pwTooShort, !!pw && !pwTooShort)}>
                                        <label htmlFor="Password">Mật khẩu</label>
                                        <input
                                            id="Password"
                                            className="form-control"
                                            type="password"
                                            value={form.Password}
                                            onChange={(e) => setField("Password", e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            required
                                        />
                                        {pwTooShort && (
                                            <p className="help-block">Mật khẩu phải ít nhất 6 ký tự.</p>
                                        )}
                                    </div>

                                    <div className={fgClass(!String(form.TeacherName || "").trim() && form.TeacherName !== "", !!String(form.TeacherName || "").trim())}>
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

                                    <div className={fgClass(!String(form.PhoneNumber || "").trim() && form.PhoneNumber !== "", !!String(form.PhoneNumber || "").trim())}>
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

                                    <button type="submit" className="btn btn-primary" disabled={saving || formInvalid}>
                                        {saving ? "Đang tạo..." : "Tạo giáo viên"}
                                    </button>{" "}
                                    <Link to="/teachers" className="btn btn-default">
                                        Hủy
                                    </Link>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal xác nhận ở giữa màn hình (đồng bộ AddClassPage) */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận tạo giáo viên"
                message={`Tạo tài khoản cho "${(form.TeacherName || "").trim() || "giáo viên mới"}"?`}
                details="Tài khoản có thể chỉnh sửa sau khi tạo."
                confirmText="Tạo giáo viên"
                cancelText="Xem lại"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doCreate}
                busy={saving}
            />

            {/* Toasts dùng chung */}
            <Toasts />
        </>
    );
}
