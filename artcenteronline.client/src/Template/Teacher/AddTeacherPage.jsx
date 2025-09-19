// src/Template/Teacher/AddTeacherPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTeacher } from "./teachers";

// ===== Toast error giống Schedule =====
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

export default function AddTeacherPage() {
    const navigate = useNavigate();
    const toast = useToast();

    const [form, setForm] = useState({
        Email: "",
        Password: "",
        TeacherName: "",
        PhoneNumber: "",
        status: 1,
    });
    const [saving, setSaving] = useState(false);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // ===== Realtime validation =====
    const email = (form.Email || "").trim();
    const emailInvalid = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const pw = String(form.Password || "");
    const pwTooShort = pw.length > 0 && pw.length < 6;

    function fgClass(error, success) {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    }

    function validate() {
        if (!email) return "Vui lòng nhập Email.";
        if (emailInvalid) return "Email không hợp lệ.";
        if (!pw || pw.length < 6) return "Mật khẩu phải ít nhất 6 ký tự.";
        if (!String(form.TeacherName || "").trim()) return "Vui lòng nhập Tên giáo viên.";
        if (!String(form.PhoneNumber || "").trim()) return "Vui lòng nhập Số điện thoại.";
        return "";
    }

    const formInvalid = !email || emailInvalid || !pw || pwTooShort || !String(form.TeacherName || "").trim() || !String(form.PhoneNumber || "").trim();

    async function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) return toast.show(v);

        setSaving(true);
        try {
            await createTeacher({
                Email: email,
                Password: form.Password,
                TeacherName: form.TeacherName.trim(),
                PhoneNumber: form.PhoneNumber.trim(),
                status: Number(form.status),
            });
            navigate("/teachers", { state: { notice: "Đã thêm giáo viên mới." } });
        } catch (e) {
            toast.show(extractErr(e)); // 409 trùng email sẽ hiển thị ở đây
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <section className="content-header">
                <h1>THÊM GIÁO VIÊN</h1>
                <ol className="breadcrumb">
                    <li>
                        <Link to="/">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </Link>
                    </li>
                    <li>
                        <Link to="/teachers">Giáo viên</Link>
                    </li>
                    <li className="active">Thêm mới</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-12 col-lg-12">
                        <div className="box box-primary">
                            <div className="box-body">
                                <form onSubmit={onSubmit}>
                                    <div className={fgClass(email && emailInvalid, email && !emailInvalid)}>
                                        <label htmlFor="Email">Email</label>
                                        <input
                                            id="Email"
                                            className="form-control"
                                            type="email"
                                            value={form.Email}
                                            onChange={(e) => setField("Email", e.target.value)}
                                            required
                                        />
                                        {email && emailInvalid && (
                                            <p className="help-block">Email không hợp lệ.</p>
                                        )}
                                        {email && !emailInvalid && (
                                            <p className="help-block text-green">Email hợp lệ.</p>
                                        )}
                                    </div>

                                    <div className={fgClass(pwTooShort, !!pw && !pwTooShort)}>
                                        <label htmlFor="Password">Mật khẩu</label>
                                        <input
                                            id="Password"
                                            className="form-control"
                                            type="password"
                                            value={form.Password}
                                            onChange={(e) => setField("Password", e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            required
                                        />
                                        {pwTooShort && (
                                            <p className="help-block">Mật khẩu phải ít nhất 6 ký tự.</p>
                                        )}
                                    </div>

                                    <div className={fgClass(!String(form.TeacherName || "").trim() && form.TeacherName !== "", !!String(form.TeacherName || "").trim())}>
                                        <label htmlFor="TeacherName">Tên giáo viên</label>
                                        <input
                                            id="TeacherName"
                                            className="form-control"
                                            type="text"
                                            value={form.TeacherName}
                                            onChange={(e) => setField("TeacherName", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className={fgClass(!String(form.PhoneNumber || "").trim() && form.PhoneNumber !== "", !!String(form.PhoneNumber || "").trim())}>
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input
                                            id="PhoneNumber"
                                            className="form-control"
                                            type="tel"
                                            value={form.PhoneNumber}
                                            onChange={(e) => setField("PhoneNumber", e.target.value)}
                                            required
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
                                            <option value={1}>Đang dạy</option>
                                            <option value={0}>Ngừng dạy</option>
                                        </select>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={saving || formInvalid}>
                                        {saving ? "Đang tạo..." : "Tạo giáo viên"}
                                    </button>{" "}
                                    <Link to="/teachers" className="btn btn-default">
                                        Hủy
                                    </Link>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Toast lỗi nổi */}
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
                                background: "#a94442",
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
