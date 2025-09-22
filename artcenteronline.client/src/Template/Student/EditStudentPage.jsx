// src/Template/Student/EditStudentPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateStudent, getStudent } from "./students.js";

// ===== Helpers =====
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

// Chuẩn hóa value từ API về yyyy-MM-dd
function anyToISO(v) {
    if (!v) return "";
    const s = String(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function extractErr(e) {
    const r = e?.response;
    return (
        r?.data?.message ||
        r?.data?.detail ||
        r?.data?.title ||
        (typeof r?.data === "string" ? r.data : null) ||
        e?.message ||
        "Có lỗi xảy ra khi lưu."
    );
}

export default function EditStudentPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form giữ ISO yyyy-MM-dd
    const [form, setForm] = useState({
        StudentName: "",
        ParentName: "",
        PhoneNumber: "",
        Adress: "",
        ngayBatDauHoc: "",
        SoBuoiHocConLai: 0,
        SoBuoiHocDaHoc: 0,
        Status: 1,
    });

    // Text hiển thị dd/MM/yyyy
    const [ngayBatDauHocText, setNgayBatDauHocText] = useState("");

    // ==== Toast lỗi: đếm ngược 5s + progress ====
    const AUTO_DISMISS = 5000;
    const [err, setErr] = useState("");
    const [remaining, setRemaining] = useState(0);
    function showError(msg) {
        setErr(msg || "");
        if (msg) setRemaining(AUTO_DISMISS);
    }
    useEffect(() => {
        if (!err) return;
        const startedAt = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, AUTO_DISMISS - (Date.now() - startedAt));
            setRemaining(left);
            if (left === 0) setErr("");
        }, 1000);
        return () => clearInterval(iv);
    }, [err]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const data = await getStudent(id);
                if (!data) throw new Error("Không tìm thấy học viên.");
                if (ignore) return;

                const pick = (obj, pascal, camel, def = "") =>
                    obj?.[pascal] ?? obj?.[camel] ?? def;

                const iso = anyToISO(pick(data, "ngayBatDauHoc", "ngayBatDauHoc", ""));

                setForm({
                    StudentName: pick(data, "StudentName", "studentName"),
                    ParentName: pick(data, "ParentName", "parentName"),
                    PhoneNumber: pick(data, "PhoneNumber", "phoneNumber"),
                    Adress: pick(data, "Adress", "adress"),
                    ngayBatDauHoc: iso,
                    SoBuoiHocConLai: Number(pick(data, "SoBuoiHocConLai", "soBuoiHocConLai", 0)),
                    SoBuoiHocDaHoc: Number(pick(data, "SoBuoiHocDaHoc", "soBuoiHocDaHoc", 0)),
                    Status: Number(pick(data, "Status", "status", 1)),
                });
                setNgayBatDauHocText(isoToDMY(iso));
            } catch (e) {
                showError(e.message || "Không tải được dữ liệu học viên.");
            } finally {
                setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [id]);

    function setField(name, value) {
        setForm((f) => ({ ...f, [name]: value }));
        if (err) showError(""); // chỉnh gì cũng clear lỗi
    }

    function validate() {
        if (!form.StudentName?.trim()) return "Vui lòng nhập Tên học viên.";
        if (!form.ngayBatDauHoc) return "Vui lòng nhập Ngày bắt đầu học (dd/mm/yyyy).";
        if (form.SoBuoiHocConLai < 0) return "Số buổi học đã đóng không hợp lệ.";
        if (form.SoBuoiHocDaHoc < 0) return "Số buổi đã học không hợp lệ.";
        if (form.PhoneNumber.length > 10) return "Số điện thoại không hợp lệ";
        return "";
    }

    async function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) return showError(v);

        setSaving(true);
        try {
            await updateStudent(id, { ...form, ngayBatDauHoc: form.ngayBatDauHoc });
            navigate("/students", { state: { notice: "Đã cập nhật học viên." } });
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <>
                <section className="content">
                    <div className="box"><div className="box-body">Đang tải…</div></div>
                </section>
                {err && (
                    <div
                        className="alert alert-danger"
                        style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                    >
                        <button type="button" className="close" onClick={() => showError("")}><span aria-hidden="true">&times;</span></button>
                        {err}
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                            Tự ẩn sau {(remaining / 1000).toFixed(1)}s
                        </div>
                        <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                            <div
                                style={{
                                    height: "100%",
                                    width: `${(remaining / AUTO_DISMISS) * 100}%`,
                                    background: "#a94442",
                                    transition: "width 100ms linear"
                                }}
                            />
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>Cập nhật học viên</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/students">Học viên</Link></li>
                    <li className="active">Cập nhật</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <form onSubmit={onSubmit}>
                        <div className="box-header with-border">
                            <h3 className="box-title">Thông tin học viên</h3>
                        </div>

                        <div className="box-body">
                            <div className="form-group">
                                <label htmlFor="StudentName">Tên học viên</label>
                                <input
                                    id="StudentName"
                                    className="form-control"
                                    type="text"
                                    value={form.StudentName}
                                    onChange={(e) => setField("StudentName", e.target.value)}
                                    required
                                />
                            </div>

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

                            <div className="form-group">
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
                                    onBlur={() => {
                                        const iso = dmyToISO(ngayBatDauHocText);
                                        if (iso) setNgayBatDauHocText(isoToDMY(iso));
                                    }}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="SoBuoiHocConLai">Số buổi học đã đóng</label>
                                <input
                                    id="SoBuoiHocConLai"
                                    className="form-control"
                                    type="number"
                                    min={0}
                                    value={form.SoBuoiHocConLai}
                                    onChange={(e) => setField("SoBuoiHocConLai", Number(e.target.value))}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="SoBuoiHocDaHoc">Số buổi đã học</label>
                                <input
                                    id="SoBuoiHocDaHoc"
                                    className="form-control"
                                    type="number"
                                    min={0}
                                    value={form.SoBuoiHocDaHoc}
                                    onChange={(e) => setField("SoBuoiHocDaHoc", Number(e.target.value))}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="Status">Trạng thái</label>
                                <select
                                    id="Status"
                                    className="form-control"
                                    value={form.Status}
                                    onChange={(e) => setField("Status", Number(e.target.value))}
                                >
                                    <option value={1}>Đang học</option>
                                    <option value={0}>Ngừng học</option>
                                </select>
                            </div>
                        </div>

                        <div className="box-footer">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <i className="fa fa-save" /> {saving ? "Đang lưu..." : "Lưu"}
                            </button>
                            <Link to="/students" className="btn btn-default" style={{ marginLeft: 10 }}>
                                Hủy
                            </Link>
                        </div>
                    </form>
                </div>
            </section>

            {/* Toast lỗi nổi (đếm ngược + progress) */}
            {err && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => showError("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {err}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(remaining / 1000).toFixed(1)}s
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(remaining / AUTO_DISMISS) * 100}%`,
                                background: "#a94442",
                                transition: "width 100ms linear"
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
