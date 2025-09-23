// src/Template/User/AddUserPage.jsx
import React, { useState } from "react";
import { createUser } from "./users";
import { useNavigate, Link } from "react-router-dom";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function AddUserPage() {
    const navigate = useNavigate();
    const { showError, showSuccess, Toasts } = useToasts();

    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        userEmail: "",
        password: "",
        password2: "",
        status: 1, // 1: Active, 0: Inactive
        role: "Teacher", // Teacher | Student (không cho tạo Admin)
    });

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((s) => ({ ...s, [name]: name === "status" ? Number(value) : value }));
    };

    // ===== Realtime validation =====
    const email = (form.userEmail || "").trim();
    const emailInvalid = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const trimmed = (form.password || "").trim();
    const trimmed2 = (form.password2 || "").trim();

    const pwTooShort = trimmed.length > 0 && trimmed.length < 6;
    const pwMismatch = (trimmed || trimmed2) && trimmed !== trimmed2;
    const pwMatchOk = !!trimmed && !!trimmed2 && trimmed === trimmed2 && !pwTooShort;

    const isAdmin = String(form.role || "").toLowerCase() === "admin";

    function fgClass(error, success) {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    }

    function validate() {
        if (isAdmin) return "Không thể tạo tài khoản role Admin.";
        if (!email) return "Vui lòng nhập Email.";
        if (emailInvalid) return "Email không hợp lệ.";
        if (!trimmed) return "Vui lòng nhập mật khẩu.";
        if (pwTooShort) return "Mật khẩu phải ít nhất 6 ký tự.";
        if (pwMismatch) return "Xác nhận mật khẩu không khớp.";
        return "";
    }

    const formInvalid =
        isAdmin || !email || emailInvalid || !trimmed || pwTooShort || pwMismatch;

    async function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) return showError(v);

        setSaving(true);
        try {
            await createUser({
                UserEmail: email,
                Password: trimmed,
                Status: form.status,
                role: form.role,
            });
            navigate("/users", {
                state: { notice: "Tạo tài khoản thành công" },
                replace: true,
            });
        } catch (e) {
            showError(extractErr(e) || "Có lỗi xảy ra khi tạo tài khoản.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Thêm người dùng</h1>
                <ol className="breadcrumb">
                    <li>
                        <a href="#">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </a>
                    </li>
                    <li>
                        <Link to="/users">Quản lý người dùng</Link>
                    </li>
                    <li className="active">Thêm người dùng mới</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Tạo tài khoản mới</h3>
                    </div>

                    <div className="box-body">
                        <form onSubmit={onSubmit}>
                            {/* Email */}
                            <div className={fgClass(email && emailInvalid, email && !emailInvalid)}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    name="userEmail"
                                    value={form.userEmail}
                                    onChange={onChange}
                                    required
                                />
                                {email && emailInvalid && (
                                    <p className="help-block">Email không hợp lệ.</p>
                                )}
                                {email && !emailInvalid && (
                                    <p className="help-block text-green">Email hợp lệ.</p>
                                )}
                            </div>

                            {/* Mật khẩu */}
                            <div className={fgClass(pwTooShort, !!trimmed && !pwTooShort)}>
                                <label>Mật khẩu</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    name="password"
                                    value={form.password}
                                    onChange={onChange}
                                    placeholder="Tối thiểu 6 ký tự"
                                    required
                                />
                                {pwTooShort && (
                                    <p className="help-block">Mật khẩu phải có ít nhất 6 ký tự.</p>
                                )}
                            </div>

                            {/* Xác nhận mật khẩu */}
                            <div className={fgClass(pwMismatch, pwMatchOk)}>
                                <label>Nhập lại mật khẩu</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    name="password2"
                                    value={form.password2}
                                    onChange={onChange}
                                    placeholder="Nhập lại mật khẩu"
                                    required
                                />
                                {pwMismatch && (
                                    <p className="help-block">Xác nhận mật khẩu không khớp.</p>
                                )}
                                {pwMatchOk && (
                                    <p className="help-block text-green">Mật khẩu khớp.</p>
                                )}
                            </div>

                            {/* Vai trò */}
                            <div className="form-group">
                                <label>Vai trò</label>
                                <select
                                    className="form-control"
                                    name="role"
                                    value={form.role}
                                    onChange={onChange}
                                >
                                    <option value="Teacher">Giáo viên</option>
                                    <option value="Student">Học sinh</option>
                                </select>
                                {isAdmin && (
                                    <p className="text-red small">Không thể tạo role Admin.</p>
                                )}
                            </div>

                            {/* Trạng thái */}
                            <div className="form-group">
                                <label>Trạng thái</label>
                                <select
                                    className="form-control"
                                    name="status"
                                    value={form.status}
                                    onChange={onChange}
                                >
                                    <option value={1}>Hoạt động</option>
                                    <option value={0}>Ngừng hoạt động</option>
                                </select>
                            </div>

                            <div className="box-footer">
                                <Link to="/users" className="btn btn-default">
                                    Quay lại
                                </Link>
                                <button
                                    type="submit"
                                    className="btn btn-primary pull-right"
                                    disabled={saving || formInvalid}
                                >
                                    {saving ? "Đang lưu..." : "Tạo mới"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
