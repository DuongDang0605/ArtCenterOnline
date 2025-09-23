// src/Template/User/EditUserPage.jsx
import React, { useEffect, useState } from "react";
import { getUser, updateUser } from "./users";
import { useNavigate, useParams, Link } from "react-router-dom";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function EditUserPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showError, showSuccess, Toasts } = useToasts();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        userEmail: "",
        password: "",
        password2: "",
        status: 1,
        role: "",
    });

    const [pwTouched, setPwTouched] = useState(false);
    const [pw2Touched, setPw2Touched] = useState(false);

    const isAdmin = String(form.role || "").toLowerCase() === "admin";

    useEffect(() => {
        let alive = true;

        if (!id || Number.isNaN(Number(id))) {
            showError("Thiếu hoặc ID người dùng không hợp lệ.");
            setLoading(false);
            return () => { alive = false; };
        }

        (async () => {
            try {
                const data = await getUser(id);
                if (!alive) return;
                setForm({
                    userEmail: data?.userEmail ?? "",
                    password: "",
                    password2: "",
                    status: data?.status ?? 0,
                    role: data?.role ?? "",
                });
            } catch (e) {
                if (alive) showError(extractErr(e) || "Không tải được dữ liệu.");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [id, showError]);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((s) => ({ ...s, [name]: name === "status" ? Number(value) : value }));
    };

    // ===== Realtime validation =====
    const trimmed = (form.password || "").trim();
    const trimmed2 = (form.password2 || "").trim();

    const pwTooShort = !!trimmed && trimmed.length < 6;
    const pwMismatch = (!!trimmed || !!trimmed2) && trimmed !== trimmed2;
    const pwMatchOk = !!trimmed && !!trimmed2 && trimmed === trimmed2 && !pwTooShort;

    const formInvalid = pwTooShort || pwMismatch;

    const fgClass = (error, success) => {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (isAdmin) {
            showError("Không thể chỉnh sửa tài khoản Admin.");
            return;
        }
        if (formInvalid) {
            showError("Vui lòng sửa lỗi ở phần mật khẩu trước khi lưu.");
            return;
        }

        try {
            setSaving(true);

            const payload = {
                UserId: Number(id),
                Status: form.status,
            };
            if (trimmed) payload.Password = trimmed;

            await updateUser(Number(id), payload);

            navigate("/users", {
                state: { notice: "Cập nhật thành công." },
                replace: true,
            });
        } catch (e) {
            showError(extractErr(e) || "Cập nhật thất bại.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Chỉnh sửa tài khoản</h1>
                <ol className="breadcrumb">
                    <li>
                        <a href="#">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </a>
                    </li>
                    <li>
                        <Link to="/users">Quản lý người dùng</Link>
                    </li>
                    <li className="active">Sửa tài khoản</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Cập nhật thông tin</h3>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}

                        {!loading && (
                            <form onSubmit={onSubmit}>
                                {isAdmin && (
                                    <div className="alert alert-warning">
                                        Tài khoản có role <b>Admin</b> — không được phép chỉnh sửa.
                                    </div>
                                )}

                                {/* Email: chỉ hiển thị */}
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        name="userEmail"
                                        value={form.userEmail}
                                        onChange={onChange}
                                        disabled
                                    />
                                    <p className="help-block">Email không thể thay đổi.</p>
                                </div>

                                {/* Mật khẩu mới */}
                                <div className={fgClass(pwTouched && pwTooShort, false)}>
                                    <label>Mật khẩu mới (để trống nếu không đổi)</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        name="password"
                                        value={form.password}
                                        onChange={onChange}
                                        onBlur={() => setPwTouched(true)}
                                        placeholder="Để trống nếu không thay đổi"
                                        disabled={isAdmin}
                                    />
                                    {pwTouched && pwTooShort && (
                                        <p className="help-block">Mật khẩu mới phải có ít nhất 6 ký tự.</p>
                                    )}
                                </div>

                                {/* Xác nhận mật khẩu mới */}
                                <div className={fgClass(pw2Touched && pwMismatch, pw2Touched && pwMatchOk)}>
                                    <label>Nhập lại mật khẩu mới</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        name="password2"
                                        value={form.password2}
                                        onChange={onChange}
                                        onBlur={() => setPw2Touched(true)}
                                        placeholder="Nhập lại mật khẩu mới"
                                        disabled={isAdmin}
                                    />
                                    {pw2Touched && pwMismatch && (
                                        <p className="help-block">Xác nhận mật khẩu không khớp.</p>
                                    )}
                                    {pw2Touched && pwMatchOk && (
                                        <p className="help-block text-green">Mật khẩu khớp.</p>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Vai trò</label>
                                    <input type="text" className="form-control" value={form.role} disabled />
                                    <p className="help-block">Vai trò được lưu trên server và không chỉnh tại đây.</p>
                                </div>

                                <div className="form-group">
                                    <label>Trạng thái</label>
                                    <select
                                        className="form-control"
                                        name="status"
                                        value={form.status}
                                        onChange={onChange}
                                        disabled={isAdmin}
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
                                        disabled={isAdmin || saving || formInvalid}
                                    >
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
