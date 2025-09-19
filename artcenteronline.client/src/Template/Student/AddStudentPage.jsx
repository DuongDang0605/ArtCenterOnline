// src/Template/Student/AddStudentPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudent } from "./students.js"; // POST /Students (giữ nguyên) :contentReference[oaicite:1]{index=1}

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

// ===== Toast giống AddTeacherPage =====
const AUTO_DISMISS = 5000;
function useToast() {
    const [msg, setMsg] = useState("");
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        if (!msg) return;
        const start = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - start));
            setRemaining(left);
            if (left === 0) setMsg("");
        }, 100);
        return () => clearInterval(iv);
    }, [msg]);

    return {
        msg,
        remaining,
        show: (m) => {
            setMsg(m || "Đã xảy ra lỗi.");
            setRemaining(AUTO_DISMISS);
        },
        hide: () => setMsg(""),
    };
}
function extractErr(e) {
    const r = e?.response;
    return (
        r?.data?.message ||
        r?.data?.detail ||
        r?.data?.title ||
        (typeof r?.data === "string" ? r.data : null) ||
        e?.message ||
        "Có lỗi xảy ra."
    );
}

export default function AddStudentPage() {
    const navigate = useNavigate();
    const toast = useToast();

    // Thông tin thành công để bật modal
    const [successInfo, setSuccessInfo] = useState(null); // { studentId, email, tempPassword }

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
    const [errors, setErrors] = useState([]); // lỗi validate form tổng quát (giữ lại cấu trúc cũ để show trong box)
    const [ngayBatDauHocText, setNgayBatDauHocText] = useState("");

    useEffect(() => {
        setNgayBatDauHocText(isoToDMY(form.ngayBatDauHoc));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    // ===== Realtime validation & highlight style giống AddTeacherPage ===== :contentReference[oaicite:2]{index=2}
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
    // eslint-disable-next-line no-unused-vars
    const accountInvalid =
        (requireAccount && (!pw || pw.length < 6)) ||
        (requireAccount && (cpw !== pw));

    function validate() {
        const errs = [];
        if (!String(form.StudentName || "").trim()) errs.push("Vui lòng nhập tên học viên.");
        if (!form.ngayBatDauHoc) errs.push("Vui lòng nhập ngày bắt đầu học (định dạng dd/mm/yyyy).");
        const n = Number(form.SoBuoiHocDaHoc);
        if (Number.isNaN(n) || n < 0) errs.push("Số buổi đã học phải là số không âm.");

        if (email) {
            if (emailInvalid) errs.push("Email không hợp lệ.");
            if (!pw || pw.length < 6) errs.push("Mật khẩu phải ít nhất 6 ký tự.");
            if (cpw !== pw) errs.push("Xác nhận mật khẩu không khớp.");
        }
        return errs;
    }

    // disable nút Lưu khi không hợp lệ
    const formInvalid =
        !String(form.StudentName || "").trim() ||
        !form.ngayBatDauHoc ||
        (email && emailInvalid) ||
        (requireAccount && (pwTooShort || cpwMismatch || !pw || !cpw));

    async function onSubmit(e) {
        e.preventDefault();
        setErrors([]);
        const v = validate();
        if (v.length) {
            setErrors(v);
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
            const info = {
                studentId: res?.studentId ?? res?.StudentId ?? res?.id ?? null,
                email: res?.email ?? (res?.StudentId ? `student${res.StudentId}@example.com` : null),
                tempPassword: res?.tempPassword ?? (email ? form.Password : "123456"),
            };
            if (!info.email && info.studentId != null) info.email = `student${info.studentId}@example.com`;
            setSuccessInfo(info);
        } catch (e) {
            toast.show(extractErr(e)); // ví dụ 409 trùng email
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

                            {/* Khối lỗi tổng quát (giữ nguyên kiểu cũ) */} {/* :contentReference[oaicite:3]{index=3} */}
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
                                        <label htmlFor="Password">Mật khẩu {requireAccount ? <small>(bắt buộc khi có email)</small> : <small className="text-muted">(tùy chọn)</small>}</label>
                                        <input
                                            id="Password"
                                            className="form-control"
                                            type="password"
                                            value={form.Password}
                                            onChange={(e) => setField("Password", e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            disabled={!requireAccount && !pw} // cho nhập nếu muốn, còn nếu chưa nhập thì coi như bỏ qua
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
                                            disabled={!requireAccount && !cpw}
                                        />
                                        {requireAccount && cpw && cpwMismatch && <p className="help-block">Xác nhận mật khẩu không khớp.</p>}
                                        {requireAccount && cpw && !cpwMismatch && <p className="help-block text-green">Mật khẩu khớp.</p>}
                                        {!requireAccount && cpw && cpwMismatch && <p className="help-block">Xác nhận mật khẩu không khớp.</p>}
                                        {!requireAccount && cpw && !cpwMismatch && <p className="help-block text-green">Mật khẩu khớp.</p>}
                                    </div>

                                    {/* Buttons */}
                                    <div className="form-group" style={{ marginTop: 20 }}>
                                        <button type="submit" className="btn btn-primary" disabled={saving || formInvalid}>
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
                                <p><strong>Tài khoản:</strong> <code style={{ fontSize: 16 }}>{successInfo.email || "(không xác định)"}</code></p>
                                <p><strong>Mật khẩu:</strong> <code style={{ fontSize: 16 }}>{successInfo.tempPassword}</code></p>
                                <p className="text-muted" style={{ marginTop: 10 }}>Vui lòng hướng dẫn học viên đổi mật khẩu sau khi đăng nhập lần đầu.</p>
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

            {/* Toast lỗi nổi (giống trang Teacher) */}
            {toast.msg && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={toast.hide}>
                        <span>&times;</span>
                    </button>
                    {toast.msg}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(toast.remaining / 1000).toFixed(1)}s
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(toast.remaining / AUTO_DISMISS) * 100}%`,
                                transition: "width 100ms linear",
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
