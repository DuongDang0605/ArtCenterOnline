// src/Template/Teacher/EditTeacherPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTeacher, updateTeacher } from "./teachers";

export default function EditTeacherPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        TeacherId: Number(id),
        UserId: 0,
        Email: "",
        TeacherName: "",
        PhoneNumber: "",
        status: 1,
        Password: "",
    });
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    useEffect(() => {
        (async () => {
            try {
                const data = await getTeacher(id);
                setForm((f) => ({
                    ...f,
                    TeacherId: Number(data?.teacherId ?? data?.TeacherId ?? id),
                    UserId: Number(data?.userId ?? data?.UserId ?? 0),
                    Email: String(data?.email ?? data?.Email ?? ""),
                    TeacherName: String(data?.teacherName ?? data?.TeacherName ?? ""),
                    PhoneNumber: String(data?.phoneNumber ?? data?.PhoneNumber ?? ""),
                    status: Number(data?.status ?? data?.Status ?? 1),
                }));
            } catch (e) {
                console.error(e);
                setErrors([e?.message || "Tải dữ liệu thất bại."]);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    function validate() {
        const es = [];
        if (!String(form.TeacherName || "").trim()) es.push("Vui lòng nhập Tên giáo viên.");
        if (!String(form.PhoneNumber || "").trim()) es.push("Vui lòng nhập Số điện thoại.");
        setErrors(es);
        return es.length === 0;
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

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
            navigate("/teachers");
        } catch (e) {
            console.error(e);
            setErrors([e?.message || "Cập nhật thất bại."]);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="content-wrapper"><section className="content"><p>Đang tải...</p></section></div>;
    }

    return (
        <div className="content-wrapper">
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
                                        <label htmlFor="Email">Email (tuỳ chọn)</label>
                                        <input id="Email" className="form-control" type="email"
                                            value={form.Email} onChange={(e) => setField("Email", e.target.value)} />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="Password">Đổi mật khẩu (tuỳ chọn)</label>
                                        <input id="Password" className="form-control" type="password"
                                            value={form.Password} onChange={(e) => setField("Password", e.target.value)} />
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
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
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
