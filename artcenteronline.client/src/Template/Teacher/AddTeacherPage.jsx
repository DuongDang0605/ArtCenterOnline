// src/Template/Teacher/AddTeacherPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTeacher } from "./teachers";

export default function AddTeacherPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        Email: "",
        Password: "",
        TeacherName: "",
        PhoneNumber: "",
        status: 1,
    });
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    function validate() {
        const es = [];
        if (!form.Email.trim()) es.push("Vui lòng nhập Email.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email.trim())) es.push("Email không hợp lệ.");
        if (!form.Password || String(form.Password).length < 6) es.push("Password phải ít nhất 6 ký tự.");
        if (!form.TeacherName.trim()) es.push("Vui lòng nhập Tên giáo viên.");
        if (!form.PhoneNumber.trim()) es.push("Vui lòng nhập Số điện thoại.");
        setErrors(es);
        return es.length === 0;
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            await createTeacher({
                Email: form.Email.trim(),
                Password: form.Password,
                TeacherName: form.TeacherName.trim(),
                PhoneNumber: form.PhoneNumber.trim(),
                status: Number(form.status),
            });
            navigate("/teachers");
        } catch (e) {
            console.error(e);
            setErrors([e?.message || "Tạo giáo viên thất bại."]);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="content-wrapper">
            <section className="content-header">
                <h1>THÊM GIÁO VIÊN</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/teachers">Giáo viên</Link></li>
                    <li className="active">Thêm mới</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-11 col-lg-11">
                        <div className="box box-primary">
                            <div className="box-body">
                                {errors.length > 0 && (
                                    <div className="alert alert-danger">
                                        <ul style={{ marginBottom: 0 }}>
                                            {errors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}

                                <form onSubmit={onSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="Email">Email</label>
                                        <input id="Email" className="form-control" type="email"
                                            value={form.Email} onChange={(e) => setField("Email", e.target.value)} required />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="Password">Password</label>
                                        <input id="Password" className="form-control" type="password"
                                            value={form.Password} onChange={(e) => setField("Password", e.target.value)} required />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="TeacherName">Tên giáo viên</label>
                                        <input id="TeacherName" className="form-control" type="text"
                                            value={form.TeacherName} onChange={(e) => setField("TeacherName", e.target.value)} required />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input id="PhoneNumber" className="form-control" type="tel"
                                            value={form.PhoneNumber} onChange={(e) => setField("PhoneNumber", e.target.value)} required />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="status">Trạng thái</label>
                                        <select id="status" className="form-control"
                                            value={form.status} onChange={(e) => setField("status", Number(e.target.value))}>
                                            <option value={1}>Đang dạy</option>
                                            <option value={0}>Ngừng dạy</option>
                                        </select>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? "Đang tạo..." : "Tạo giáo viên"}
                                    </button>{" "}
                                    <Link to="/teachers" className="btn btn-default">Hủy</Link>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
