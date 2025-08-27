// src/Template/Teacher/EditTeacherPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTeacher, updateTeacher } from "./teachers";

export default function EditTeacherPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    const [form, setForm] = useState({
        TeacherId: 0,
        UserId: 0,
                  // có thể chỉnh email nếu BE hỗ trợ
        TeacherName: "",
        PhoneNumber: "",
        SoBuoiDayTrongThang: 0,
        status: 1,                 // 1=Active, 0=Inactive
           // để trống => giữ hash cũ
    });

    const setField = (name, value) =>
        setForm((f) => ({ ...f, [name]: value }));

    // --- Load dữ liệu ban đầu ---
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const data = await getTeacher(id); // kỳ vọng trả về chi tiết teacher
                if (!mounted) return;

                // Chuẩn hóa để khớp state
                setForm({
                    TeacherId: Number(data?.teacherId ?? data?.TeacherId ?? id),
                    UserId: Number(data?.userId ?? data?.UserId ?? 0),
                    Email: String(data?.email ?? data?.Email ?? ""),
                    TeacherName: String(data?.teacherName ?? data?.TeacherName ?? ""),
                    PhoneNumber: String(data?.phoneNumber ?? data?.PhoneNumber ?? ""),
                    SoBuoiDayTrongThang: Number(
                        data?.soBuoiDayTrongThang ?? data?.SoBuoiDayTrongThang ?? 0
                    ),
                    status: Number(data?.status ?? data?.Status ?? 1),
                    Password: "" // luôn rỗng khi load
                });
            } catch (e) {
                const msg =
                    e?.response?.data?.message ||
                    e?.response?.data?.error ||
                    e?.response?.data ||
                    e?.message ||
                    "Không tải được dữ liệu giáo viên.";
                setErrors([String(msg)]);
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    // --- Validate cục bộ trước khi submit ---
    function validate() {
        const es = [];
        if (!String(form.TeacherName || "").trim())
            es.push("Vui lòng nhập Tên giáo viên.");
        if (!String(form.PhoneNumber || "").trim())
            es.push("Vui lòng nhập Số điện thoại.");
        if (Number.isNaN(Number(form.SoBuoiDayTrongThang)) || Number(form.SoBuoiDayTrongThang) < 0)
            es.push("Số buổi dạy trong tháng không hợp lệ.");
      
        setErrors(es);
        return es.length === 0;
    }

    // --- Submit ---
    async function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            const body = {
                TeacherId: Number(form.TeacherId),
                UserId: Number(form.UserId),
                // Email: có thể bỏ qua nếu BE không cho sửa email trong API này
                Email: form.Email?.trim() || undefined,
                TeacherName: form.TeacherName?.trim() || "",
                PhoneNumber: form.PhoneNumber?.trim() || "",
                SoBuoiDayTrongThang: Number(form.SoBuoiDayTrongThang) || 0,
                status: Number(form.status)
            };
            if (form.Password && form.Password.trim() !== "") {
                body.Password = form.Password;
            }

            await updateTeacher(id, body);
            navigate("/teachers");
        } catch (e) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                e?.response?.data ||
                e?.message ||
                "Lưu thất bại. Vui lòng thử lại.";
            setErrors([String(msg)]);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="content-wrapper">
            <section className="content-header">
                <h1>
                    Cập nhật giáo viên <small>ID #{id}</small>
                </h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Dashboard</Link></li>
                    <li><Link to="/teachers">Giáo viên</Link></li>
                    <li className="active">Cập nhật</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-10 col-lg-9">
                        <div className="box box-primary">
                            <div className="box-header with-border">
                                <h3 className="box-title">Thông tin giáo viên</h3>
                            </div>
                            <div className="box-body">
                                {errors.length > 0 && (
                                    <div className="alert alert-danger">
                                        <ul style={{ marginBottom: 0 }}>
                                            {errors.map((er, i) => <li key={i}>{er}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {loading ? (
                                    <p>Đang tải...</p>
                                ) : (
                                    <form onSubmit={onSubmit}>
                                        <div className="row">
                                            <div className="col-sm-6">
                                                <div className="form-group">
                                                    <label>TeacherId</label>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={form.TeacherId}
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-sm-6">
                                                <div className="form-group">
                                                    <label>UserId</label>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={form.UserId}
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                       

                                        <div className="form-group">
                                            <label htmlFor="TeacherName">Tên giáo viên</label>
                                            <input
                                                id="TeacherName"
                                                type="text"
                                                className="form-control"
                                                value={form.TeacherName}
                                                onChange={(e) => setField("TeacherName", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="PhoneNumber">Số điện thoại</label>
                                            <input
                                                id="PhoneNumber"
                                                type="text"
                                                className="form-control"
                                                value={form.PhoneNumber}
                                                onChange={(e) => setField("PhoneNumber", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="SoBuoiDayTrongThang">Số buổi dạy trong tháng</label>
                                            <input
                                                id="SoBuoiDayTrongThang"
                                                type="number"
                                                className="form-control"
                                                value={form.SoBuoiDayTrongThang}
                                                onChange={(e) => setField("SoBuoiDayTrongThang", e.target.value)}
                                                min={0}
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
                                                    <option value={1}>Active</option>
                                                    <option value={0}>Inactive</option>
                                                </select>
                                        </div>

                                     

                                        <div className="form-group">
                                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                                {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                            </button>{" "}
                                            <Link to="/teachers" className="btn btn-default">Hủy</Link>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* styling nhỏ cho field invalid */}
            <style>{`
        .is-invalid { border: 2px solid #dc3545 !important; background-color: #f8d7da !important; }
      `}</style>
        </div>
    );
}
