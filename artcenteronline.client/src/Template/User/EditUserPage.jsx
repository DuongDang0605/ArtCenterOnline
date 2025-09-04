// src/Template/User/EditUserPage.jsx
import React, { useEffect, useState } from "react";
import { getUser, updateUser } from "./users";
import { useNavigate, useParams, Link } from "react-router-dom";

export default function EditUserPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        userEmail: "",
        password: "", // ĐỂ TRỐNG NẾU KHÔNG MUỐN ĐỔI
        status: 1,
        role: "",
    });

    const isAdmin = String(form.role || "").toLowerCase() === "admin";

    useEffect(() => {
        let alive = true;

        if (!id || Number.isNaN(Number(id))) {
            setErr("Missing or invalid user id");
            setLoading(false);
            return () => {
                alive = false;
            };
        }

        (async () => {
            try {
                const data = await getUser(id);
                if (!alive) return;
                setForm({
                    userEmail: data?.userEmail ?? "",
                    password: "", // luôn để trống khi load — tránh lộ mật khẩu
                    status: data?.status ?? 0,
                    role: data?.role ?? "",
                });
            } catch (e) {
                if (alive) setErr(e?.message || "Fetch failed");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [id]);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((s) => ({ ...s, [name]: name === "status" ? Number(value) : value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (isAdmin) return; // không cho sửa admin

        // Ý #2: Nếu người dùng nhập mật khẩu thì phải >= 6 ký tự
        const trimmed = (form.password || "").trim();
        if (trimmed && trimmed.length < 6) {
            setErr("Mật khẩu mới phải có ít nhất 6 ký tự.");
            return;
        }

        try {
            setSaving(true);

            // Bắt buộc gửi UserId để BE không báo "Id không khớp"
            const payload = {
                UserId: Number(id),
                UserEmail: form.userEmail,
                Status: form.status,
            };

            // Ý #1: Không nhập mật khẩu -> KHÔNG gửi field Password => BE sẽ giữ mật khẩu cũ
            if (trimmed) {
                payload.Password = trimmed;
            }

            await updateUser(Number(id), payload);
            navigate("/users");
        } catch (e) {
            setErr(e?.message || "Update failed");
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
                        {err && <p className="text-red">Lỗi: {err}</p>}

                        {!loading && !err && (
                            <form onSubmit={onSubmit}>
                                {isAdmin && (
                                    <div className="alert alert-warning">
                                        Tài khoản có role <b>Admin</b> — không được phép chỉnh sửa.
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        name="userEmail"
                                        value={form.userEmail}
                                        onChange={onChange}
                                        disabled={isAdmin}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Mật khẩu mới (để trống nếu không đổi)</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        name="password"
                                        value={form.password}
                                        onChange={onChange}
                                        disabled={isAdmin}
                                        placeholder="Để trống nếu không thay đổi"
                                    />
                                    <p className="help-block">
                                        Nhập tối thiểu 6 ký tự nếu muốn đổi mật khẩu. Để trống để giữ mật khẩu cũ.
                                    </p>
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
                                    <button type="submit" className="btn btn-primary pull-right" disabled={isAdmin || saving}>
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
