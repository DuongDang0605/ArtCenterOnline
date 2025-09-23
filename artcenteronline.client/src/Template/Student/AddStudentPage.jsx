// src/Template/Student/AddStudentPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudent } from "./students.js"; // POST /Students
import { useToasts } from "../../hooks/useToasts";
import extractErr from "../../utils/extractErr";

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
    const { showError, Toasts } = useToasts(); // giữ Toasts để báo lỗi

    // --- form state (ngày ở dạng ISO yyyy-MM-dd)
    const [form, setForm] = useState({
        StudentName: "",
        ParentName: "",
        PhoneNumber: "",
        Adress: "",
        ngayBatDauHoc: "", // ISO
        SoBuoiHocDaHoc: 0,
        SoBuoiHocConLai: 0,
        Status: 1,

        // Tài khoản (tùy chọn): nếu nhập Email -> bắt buộc Password & ConfirmPassword hợp lệ
        Email: "",
        Password: "",
        ConfirmPassword: "",
    });

    const [saving, setSaving] = useState(false);
    const [ngayBatDauHocText, setNgayBatDauHocText] = useState("");

    // Modal “Tạo tài khoản thành công” (căn giữa)
    const [successInfo, setSuccessInfo] = useState(null);
    // successInfo shape: { studentId?: number, email?: string, tempPassword?: string }

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    // ===== Realtime validation & highlight style =====
    const email = (form.Email || "").trim();
    const emailInvalid = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const pw = String(form.Password || "");
    const pwTooShort = pw.length > 0 && pw.length < 6;

    const cpw = String(form.ConfirmPassword || "");
    const cpwMismatch = !!cpw && cpw !== pw;

    function fgClass(error, success) {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    }

    // Khi có Email -> bắt buộc Password >=6 và ConfirmPassword khớp
    const requireAccount = !!email;

    function validate() {
        const errs = [];
        if (!String(form.StudentName || "").trim()) errs.push("Vui lòng nhập tên học viên.");
        if (!form.ngayBatDauHoc) errs.push("Vui lòng nhập ngày bắt đầu học (định dạng dd/mm/yyyy).");

        const nLearned = Number(form.SoBuoiHocDaHoc);
        if (Number.isNaN(nLearned) || nLearned < 0) errs.push("Số buổi đã học phải là số không âm.");

        const nRemain = Number(form.SoBuoiHocConLai);
        if (Number.isNaN(nRemain) || nRemain < 0) errs.push("Số buổi học đã đóng phải là số không âm.");

        if (email) {
            if (emailInvalid) errs.push("Email không hợp lệ.");
            if (!pw || pw.length < 6) errs.push("Mật khẩu phải ít nhất 6 ký tự.");
            if (cpw !== pw) errs.push("Xác nhận mật khẩu không khớp.");
        }
        return errs;
    }

    // disable nút Lưu khi không hợp lệ (UI hỗ trợ; vẫn sẽ validate khi submit)
    const formInvalid =
        !String(form.StudentName || "").trim() ||
        !form.ngayBatDauHoc ||
        (email && emailInvalid) ||
        (requireAccount && (pwTooShort || cpwMismatch || !pw || !cpw));

    // Submit: không ConfirmDialog nữa — tạo luôn,
    // thành công thì hiện modal “Tạo tài khoản thành công”
    async function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v.length) {
            showError(v.join("\n")); // dùng Toasts cho lỗi
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
                // gửi Email & Password nếu có nhập Email
                Email: email || null,
                Password: email ? form.Password : null,
            };

            const res = await createStudent(payload);

            // Thử lấy dữ liệu trả về
            const data = res?.data ?? res ?? {};
            const studentId =
                data.studentId ?? data.StudentId ?? data.id ?? data.Id ?? null;
            const tempPassword =
                data.tempPassword ?? data.TempPassword ?? data.password ?? null;

            // Hiện modal “Tạo tài khoản thành công” ở giữa trang
            setSuccessInfo({
                studentId,
                email: email || data.email || data.Email || null,
                tempPassword: tempPassword || (email ? form.Password : null),
            });
        } catch (e) {
            showError(extractErr(e) || "Thêm học viên thất bại.");
        } finally {
            setSaving(false);
        }
    }

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

                            <div className="box-body">
                                <form onSubmit={onSubmit}>
                                    {/* Tên học viên */}
                                    <div className={fgClass(!String(form.StudentName || "").trim() && form.StudentName !== "", !!String(form.StudentName || "").trim())}>
                                        <label htmlFor="StudentName">Tên học viên <span className="text-danger">*</span></label>
                                        <input
                                            id="StudentName"
                                            className="form-control"
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

                                    {/* Ngày bắt đầu học */}
                                    <div className={fgClass(!form.ngayBatDauHoc && ngayBatDauHocText !== "", !!form.ngayBatDauHoc)}>
                                        <label htmlFor="ngayBatDauHoc">Ngày bắt đầu học</label>
                                        <input
                                            id="ngayBatDauHoc"
                                            className="form-control"
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

                                    {/* Số buổi học đã đóng */}
                                    <div className="form-group">
                                        <label htmlFor="SoBuoiHocConLai">Số buổi học đã đóng</label>
                                        <input
                                            id="SoBuoiHocConLai"
                                            className="form-control"
                                            type="number"
                                            min={0}
                                            value={form.SoBuoiHocConLai}
                                            onChange={(e) => setField("SoBuoiHocConLai", e.target.value)}
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

                                    {/* ===== TÀI KHOẢN ĐĂNG NHẬP (tùy chọn) ===== */}
                                    <div className={fgClass(email && emailInvalid, email && !emailInvalid)}>
                                        <label htmlFor="Email">Email đăng nhập (tùy chọn)</label>
                                        <input
                                            id="Email"
                                            className="form-control"
                                            type="email"
                                            value={form.Email}
                                            onChange={(e) => setField("Email", e.target.value)}
                                            placeholder="VD: studentA@gmail.com (để trống để hệ thống tự tạo)"
                                        />
                                        {email && emailInvalid && <p className="help-block">Email không hợp lệ.</p>}
                                        {email && !emailInvalid && <p className="help-block text-green">Email hợp lệ.</p>}
                                    </div>

                                    <div className={fgClass(requireAccount && (pwTooShort || !pw), requireAccount && !!pw && !pwTooShort)}>
                                        <label htmlFor="Password">
                                            Mật khẩu {requireAccount ? <small>(bắt buộc khi có email)</small> : <small className="text-muted">(tùy chọn)</small>}
                                        </label>
                                        <input
                                            id="Password"
                                            className="form-control"
                                            type="password"
                                            value={form.Password}
                                            onChange={(e) => setField("Password", e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            disabled={!requireAccount && !pw}
                                        />
                                        {requireAccount && pwTooShort && <p className="help-block">Mật khẩu phải ít nhất 6 ký tự.</p>}
                                        {!requireAccount && pw && pwTooShort && <p className="help-block">Mật khẩu phải ít nhất 6 ký tự.</p>}
                                    </div>

                                    <div className={fgClass(requireAccount && (cpwMismatch || !cpw), requireAccount && !!cpw && !cpwMismatch)}>
                                        <label htmlFor="ConfirmPassword">Xác nhận mật khẩu</label>
                                        <input
                                            id="ConfirmPassword"
                                            className="form-control"
                                            type="password"
                                            value={form.ConfirmPassword}
                                            onChange={(e) => setField("ConfirmPassword", e.target.value)}
                                            placeholder="Nhập lại mật khẩu"
                                            disabled={!requireAccount && !pw}
                                        />
                                        {requireAccount && cpwMismatch && <p className="help-block">Xác nhận mật khẩu không khớp.</p>}
                                    </div>

                                    <div className="box-footer">
                                        <Link to="/students" className="btn btn-default">Hủy</Link>
                                        <button type="submit" className="btn btn-primary pull-right" disabled={saving || formInvalid}>
                                            {saving ? "Đang lưu..." : "Lưu học viên"}
                                        </button>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* ===== Modal “Tạo tài khoản thành công” — CĂN GIỮA MÀN HÌNH ===== */}
            {successInfo && (
                <div
                    className="modal fade in"
                    style={{
                        display: "block",
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.5)",
                        zIndex: 1050,
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="modal-dialog"
                        role="document"
                        style={{
                            margin: 0,
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "520px",
                            maxWidth: "92vw",
                        }}
                    >
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" onClick={() => setSuccessInfo(null)}>
                                    <span aria-hidden="true">&times;</span>
                                </button>
                                <h4 className="modal-title" style={{ fontWeight: 700 }}>
                                    <i className="fa fa-check-circle text-green" /> Tạo tài khoản thành công
                                </h4>
                            </div>
                            <div className="modal-body" style={{ fontSize: 16 }}>
                                <p>
                                    Đã tạo tài khoản đăng nhập cho học viên
                                    {successInfo.studentId ? <> <strong>#{successInfo.studentId}</strong></> : null}.
                                </p>

                                <p>
                                    <strong>Tài khoản:</strong>{" "}
                                    <code style={{ fontSize: 16 }}>
                                        {successInfo.email || "(không xác định)"}
                                    </code>
                                </p>

                                {successInfo.tempPassword && (
                                    <p>
                                        <strong>Mật khẩu:</strong>{" "}
                                        <code style={{ fontSize: 16 }}>{successInfo.tempPassword}</code>
                                    </p>
                                )}

                                {!successInfo.tempPassword && (
                                    <p className="text-muted" style={{ marginTop: 10 }}>
                                        (Nếu không hiển thị mật khẩu, hệ thống có thể đã gửi email đặt lại mật khẩu cho học viên.)
                                    </p>
                                )}

                                <p className="text-muted" style={{ marginTop: 10 }}>
                                    Vui lòng hướng dẫn học viên đổi mật khẩu sau khi đăng nhập lần đầu.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-default" onClick={() => setSuccessInfo(null)}>
                                    Ở lại trang này
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => navigate("/students")}>
                                    Tiếp tục
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts (dùng để hiển thị lỗi) */}
            <Toasts />
        </>
    );
}
