// src/Template/Student/AddStudentPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudent } from "./students.js";

export default function AddStudentPage() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    // --- form state gửi lên BE (ngày ở dạng ISO yyyy-MM-dd)
    const [form, setForm] = useState({
        StudentName: "",
        ParentName: "",
        PhoneNumber: "",
        Adress: "",
        ngayBatDauHoc: "", // ISO yyyy-MM-dd
        SoBuoiDaHoc: 0,
        status: 1, // 1: Đang học, 0: Nghỉ
    });

    // --- text cho UI nhập ngày (dd/MM/yyyy)
    const [ngayBatDauHocText, setNgayBatDauHocText] = useState("");

    // ===== Helpers dd/MM/yyyy <-> yyyy-MM-dd =====
    const pad2 = (n) => String(n).padStart(2, "0");

    function dmyToISO(dmy) {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy || "");
        if (!m) return null;
        const d = +m[1], mo = +m[2], y = +m[3];
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    function isoToDMY(iso) {
        if (!iso) return "";
        const [y, mo, d] = String(iso).split("-");
        return `${d}/${mo}/${y}`;
    }

    // nếu có giá trị mặc định ở form.ngayBatDauHoc thì hiển thị text tương ứng
    useEffect(() => {
        setNgayBatDauHocText(isoToDMY(form.ngayBatDauHoc));
    }, []); // chạy 1 lần

    const setField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const validate = () => {
        const errs = [];
        if (!form.StudentName?.trim()) errs.push("Vui lòng nhập tên học viên.");
        if (!form.ngayBatDauHoc) errs.push("Vui lòng nhập ngày bắt đầu học (định dạng dd/mm/yyyy).");
        const n = Number(form.SoBuoiDaHoc);
        if (Number.isNaN(n) || n < 0) errs.push("Số buổi đã học phải là số không âm.");
        return errs;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setErrors([]);

        const errs = validate();
        if (errs.length) {
            setErrors(errs);
            return;
        }

        setSaving(true);
        try {
            // Gửi đúng keys như BE đang nhận (case-insensitive, nhưng giữ nguyên như cũ cho chắc)
            const payload = {
                StudentName: form.StudentName?.trim(),
                ParentName: form.ParentName?.trim(),
                PhoneNumber: form.PhoneNumber?.trim(),
                Adress: form.Adress?.trim(),
                ngayBatDauHoc: form.ngayBatDauHoc, // ISO yyyy-MM-dd
                SoBuoiDaHoc: Number(form.SoBuoiDaHoc) || 0,
                status: Number(form.status) === 0 ? 0 : 1,
            };

            await createStudent(payload);
            navigate("/students");
        } catch (e) {
            console.error(e);
            setErrors(["Tạo mới thất bại. Vui lòng thử lại."]);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>THÊM HỌC VIÊN</h1>
                <ol className="breadcrumb">
                    <li>
                        <Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link>
                    </li>
                    <li>
                        <Link to="/students">Học viên</Link>
                    </li>
                    <li className="active">Thêm học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-md-12 col-lg-12">
                        <div className="box box-primary">
                            <div className="box-header with-border">
                                <h3 className="box-title">Thông tin học viên</h3>
                            </div>

                            {errors.length > 0 && (
                                <div className="box-body">
                                    <div className="alert alert-danger">
                                        <ul style={{ marginBottom: 0 }}>
                                            {errors.map((er, i) => <li key={i}>{er}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="box-body">
                                <form onSubmit={onSubmit}>
                                    {/* Tên học viên */}
                                    <div className="form-group">
                                        <label htmlFor="StudentName">Tên học viên</label>
                                        <input
                                            id="StudentName"
                                            className={`form-control ${!form.StudentName && errors.length ? "is-invalid" : ""}`}
                                            type="text"
                                            value={form.StudentName}
                                            onChange={(e) => setField("StudentName", e.target.value)}
                                            autoFocus
                                            required
                                        />
                                    </div>

                                    {/* Tên phụ huynh */}
                                    <div className="form-group">
                                        <label htmlFor="ParentName">Tên phụ huynh</label>
                                        <input
                                            id="ParentName"
                                            className="form-control"
                                            type="text"
                                            value={form.ParentName}
                                            onChange={(e) => setField("ParentName", e.target.value)}
                                        />
                                    </div>

                                    {/* Số điện thoại */}
                                    <div className="form-group">
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input
                                            id="PhoneNumber"
                                            className="form-control"
                                            type="tel"
                                            value={form.PhoneNumber}
                                            onChange={(e) => setField("PhoneNumber", e.target.value)}
                                        />
                                    </div>

                                    {/* Địa chỉ */}
                                    <div className="form-group">
                                        <label htmlFor="Adress">Địa chỉ</label>
                                        <input
                                            id="Adress"
                                            className="form-control"
                                            type="text"
                                            value={form.Adress}
                                            onChange={(e) => setField("Adress", e.target.value)}
                                        />
                                    </div>

                                    {/* Ngày bắt đầu học (dd/mm/yyyy -> ISO) */}
                                    <div className="form-group">
                                        <label htmlFor="ngayBatDauHoc">Ngày bắt đầu học</label>
                                        <input
                                            id="ngayBatDauHoc"
                                            className={`form-control ${!form.ngayBatDauHoc && errors.length ? "is-invalid" : ""}`}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="dd/mm/yyyy"
                                            maxLength={10}
                                            value={ngayBatDauHocText}
                                            onChange={(e) => {
                                                // chỉ giữ số, tự chèn "/"
                                                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                                let out = digits;
                                                if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                                else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                                setNgayBatDauHocText(out);

                                                const iso = dmyToISO(out);
                                                setField("ngayBatDauHoc", iso ?? "");
                                            }}
                                            onBlur={() => {
                                                const iso = dmyToISO(ngayBatDauHocText);
                                                if (iso) setNgayBatDauHocText(isoToDMY(iso));
                                            }}
                                            required
                                        />
                                    </div>

                                    {/* Số buổi đã học */}
                                    <div className="form-group">
                                        <label htmlFor="SoBuoiDaHoc">Số buổi đã học</label>
                                        <input
                                            id="SoBuoiDaHoc"
                                            className="form-control"
                                            type="number"
                                            min={0}
                                            value={form.SoBuoiDaHoc}
                                            onChange={(e) => setField("SoBuoiDaHoc", e.target.value)}
                                        />
                                    </div>

                                    {/* Trạng thái */}
                                    <div className="form-group">
                                        <label htmlFor="status">Trạng thái</label>
                                        <select
                                            id="status"
                                            className="form-control"
                                            value={form.status}
                                            onChange={(e) => setField("status", Number(e.target.value))}
                                        >
                                            <option value={1}>Đang học</option>
                                            <option value={0}>Nghỉ học</option>
                                        </select>
                                    </div>

                                    {/* Buttons */}
                                    <div className="form-group" style={{ marginTop: 20 }}>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={saving}
                                        >
                                            {saving ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-save" />}{" "}
                                            Tạo mới
                                        </button>{" "}
                                        <Link to="/students" className="btn btn-default">Hủy</Link>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <style>{`
        .is-invalid { border: 2px solid #dc3545 !important; background-color: #f8d7da !important; }
      `}</style>
        </>
    );
}
