// src/Template/User/AddUserPage.jsx
import React, { useState } from "react";
import { createUser } from "./users";
import { useNavigate, Link } from "react-router-dom";

export default function AddUserPage() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);

    const [form, setForm] = useState({
        userEmail: "",
        password: "",
        status: 1,           // 1: Active, 0: Inactive
        role: "Teacher",     // Chỉ Teacher/Student
    });

    const isAdmin = String(form.role || "").toLowerCase() === "admin";

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(s => ({ ...s, [name]: name === "status" ? Number(value) : value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (isAdmin) {
            setErr("Không thể tạo tài khoản role Admin.");
            return;
        }
        try {
            setSaving(true);
            await createUser({
                UserEmail: form.userEmail,
                Password: form.password,
                Status: form.status,
                role: form.role, // backend có trường role trong model User:contentReference[oaicite:0]{index=0}
            });
            navigate("/users");
        } catch (e) {
            setErr(e?.message || "Create failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Thêm người dùng</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><Link to="/users">Users</Link></li>
                    <li className="active">Add</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Tạo tài khoản mới</h3>
                    </div>

                    <div className="box-body">
                        {err && <p className="text-red">Lỗi: {err}</p>}
                        <form onSubmit={onSubmit}>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    name="userEmail"
                                    value={form.userEmail}
                                    onChange={onChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="password"
                                    value={form.password}
                                    onChange={onChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    className="form-control"
                                    name="role"
                                    value={form.role}
                                    onChange={onChange}
                                >
                                    {/* Không có Admin trong lựa chọn */}
                                    <option value="Teacher">Teacher</option>
                                    <option value="Student">Student</option>
                                </select>
                                {isAdmin && (
                                    <p className="text-red small">Không thể tạo role Admin.</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    className="form-control"
                                    name="status"
                                    value={form.status}
                                    onChange={onChange}
                                >
                                    <option value={1}>Active</option>
                                    <option value={0}>Inactive</option>
                                </select>
                            </div>

                            <div className="box-footer">
                                <Link to="/users" className="btn btn-default">Quay lại</Link>
                                <button type="submit" className="btn btn-primary pull-right" disabled={saving}>
                                    {saving ? "Đang lưu..." : "Tạo mới"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </>
    );
}
