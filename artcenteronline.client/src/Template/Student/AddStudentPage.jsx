// src/Template/Student/AddStudentPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudent } from "./students.js";

/** dd/MM/yyyy -> ISO yyyy-MM-dd (or null if invalid) */
function dmyToISO(dmy) {
    if (!dmy) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy.trim());
    if (!m) return null;
    const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d.toISOString().slice(0, 10);
}

/** ISO yyyy-MM-dd -> dd/MM/yyyy */
function isoToDMY(iso) {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return "";
    return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function AddStudentPage() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    // Thông tin thành công để bật modal
    const [successInfo, setSuccessInfo] = useState(null); // { studentId, email, tempPassword }

    // --- form state gửi lên BE (ngày ở dạng ISO yyyy-MM-dd)
    const [form, setForm] = useState({
        StudentName: "",
        ParentName: "",
        PhoneNumber: "",
        Adress: "",
        ngayBatDauHoc: "", // ISO
        SoBuoiHocDaHoc: 0,
        SoBuoiHocConLai: 0,
        Status: 1
    });

    // Trường hiển thị ngày ở định dạng dd/MM/yyyy
    const [ngayBatDauHocText, setNgayBatDauHocText] = useState("");

    useEffect(() => {
        setNgayBatDauHocText(isoToDMY(form.ngayBatDauHoc));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    const validate = () => {
        const errs = [];
        if (!form.StudentName?.trim()) errs.push("Vui lòng nhập tên học viên.");
        if (!form.ngayBatDauHoc) errs.push("Vui lòng nhập ngày bắt đầu học (định dạng dd/mm/yyyy).");
        const n = Number(form.SoBuoiHocDaHoc);
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
            const payload = {
                StudentName: form.StudentName?.trim(),
                ParentName: form.ParentName?.trim() || null,
                PhoneNumber: form.PhoneNumber?.trim() || null,
                Adress: form.Adress?.trim() || null,
                ngayBatDauHoc: form.ngayBatDauHoc,
                SoBuoiHocDaHoc: Number(form.SoBuoiHocDaHoc) || 0,
                SoBuoiHocConLai: Number(form.SoBuoiHocConLai) || 0,
                Status: Number(form.Status) || 1,
            };

            const res = await createStudent(payload);
            const info = {
                studentId: res?.studentId ?? res?.StudentId ?? res?.id ?? null,
                email: res?.email ?? (res?.StudentId ? `student${res.StudentId}@example.com` : null),
                tempPassword: res?.tempPassword ?? "123456",
            };
            if (!info.email && info.studentId != null) info.email = `student${info.studentId}@example.com`;

            setSuccessInfo(info);
        } catch (err) {
            let msg = "Không thể tạo học viên. Vui lòng thử lại.";
            const data = err?.response?.data;
            if (typeof data === "string") msg = data;
            else if (data?.message) msg = data.message;
            else if (err?.message) msg = err.message;
            setErrors([msg]);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Content Header */}
            <section className="content-header">
                <h1>Học viên <small>Thêm mới</small></h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/students">Học viên</Link></li>
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
                                        <label htmlFor="StudentName">Tên học viên <span className="text-danger">*</span></label>
                                        <input
                                            id="StudentName"
                                            className={`form-control ${!form.StudentName && errors.length ? "is-invalid" : ""}`}
                                            type="text"
                                            value={form.StudentName}
                                            onChange={(e) => setField("StudentName", e.target.value)}
                                            placeholder="VD: Nguyễn Văn A"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Phụ huynh */}
                                    <div className="form-group">
                                        <label htmlFor="ParentName">Phụ huynh</label>
                                        <input
                                            id="ParentName"
                                            className="form-control"
                                            type="text"
                                            value={form.ParentName}
                                            onChange={(e) => setField("ParentName", e.target.value)}
                                        />
                                    </div>

                                    {/* SĐT */}
                                    <div className="form-group">
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input
                                            id="PhoneNumber"
                                            className="form-control"
                                            type="text"
                                            value={form.PhoneNumber}
                                            onChange={(e) => setField("PhoneNumber", e.target.value)}
                                            placeholder="09xxxxxxxx"
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
                                                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                                let out = digits;
                                                if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                                else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                                setNgayBatDauHocText(out);

                                                const iso = dmyToISO(out);
                                                setField("ngayBatDauHoc", iso ?? "");
                                            }}
                                        />
                                        <p className="help-block">Định dạng: dd/mm/yyyy</p>
                                    </div>

                                    {/* Số buổi đã học */}
                                    <div className="form-group">
                                        <label htmlFor="SoBuoiHocDaHoc">Số buổi đã học</label>
                                        <input
                                            id="SoBuoiHocDaHoc"
                                            className="form-control"
                                            type="number"
                                            min={0}
                                            value={form.SoBuoiHocDaHoc}
                                            onChange={(e) => setField("SoBuoiHocDaHoc", e.target.value)}
                                        />
                                    </div>

                                    {/* Trạng thái */}
                                    <div className="form-group">
                                        <label htmlFor="Status">Trạng thái</label>
                                        <select
                                            id="Status"
                                            className="form-control"
                                            value={form.Status}
                                            onChange={(e) => setField("Status", Number(e.target.value))}
                                        >
                                            <option value={1}>Đang học</option>
                                            <option value={0}>Nghỉ học</option>
                                        </select>
                                    </div>

                                    {/* Buttons */}
                                    <div className="form-group" style={{ marginTop: 20 }}>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
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

            {/* Modal thông báo tạo tài khoản thành công */}
            {successInfo && (
                <div className="modal fade in" style={{ display: "block", background: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog" role="dialog">
                        <div className="modal-content" role="document">
                            <div className="modal-header">
                                <button type="button" className="close" onClick={() => setSuccessInfo(null)}>
                                    <span>&times;</span>
                                </button>
                                <h4 className="modal-title">
                                    <i className="fa fa-check-circle text-green" /> Tạo tài khoản thành công
                                </h4>
                            </div>
                            <div className="modal-body" style={{ fontSize: 16 }}>
                                <p>Đã tạo tài khoản đăng nhập cho học viên{successInfo.studentId ? <> <strong>#{successInfo.studentId}</strong></> : null}.</p>
                                <p>
                                    <strong>Tài khoản:</strong>{" "}
                                    <code style={{ fontSize: 16 }}>{successInfo.email || "(không xác định)"}</code>
                                </p>
                                <p>
                                    <strong>Mật khẩu tạm thời:</strong>{" "}
                                    <code style={{ fontSize: 16 }}>{successInfo.tempPassword}</code>
                                </p>
                                <p className="text-muted" style={{ marginTop: 10 }}>
                                    Vui lòng hướng dẫn học viên đổi mật khẩu sau khi đăng nhập lần đầu.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-primary" onClick={() => navigate("/students")}>
                                    Tiếp tục
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .is-invalid { border: 2px solid #dc3545 !important; background-color: #f8d7da !important; }
      `}</style>
        </>
    );
}
