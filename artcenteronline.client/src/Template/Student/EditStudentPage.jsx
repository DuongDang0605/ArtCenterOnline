// src/Template/Student/EditStudentPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateStudent, getStudent } from "./students.js";

export default function EditStudentPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    // Form gửi lên BE (ngày giữ ở ISO yyyy-MM-dd)
    const [form, setForm] = useState({
        StudentName: "",
        ParentName: "",
        PhoneNumber: "",
        Adress: "",
        ngayBatDauHoc: "", // ISO yyyy-MM-dd
        SoBuoiHocConLai: 0,
        SoBuoiHocDaHoc: 0,
        Status: 1,
    });

    // Text để hiển thị/nhập ngày dd/MM/yyyy
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

    // Chuẩn hoá dữ liệu API về ISO yyyy-MM-dd (hỗ trợ cả "...T00:00:00")
    function anyToISO(v) {
        if (!v) return "";
        const s = String(v);
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); // yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const d = new Date(s);
        if (isNaN(d)) return "";
        const y = d.getFullYear();
        const mo = pad2(d.getMonth() + 1);
        const dd = pad2(d.getDate());
        return `${y}-${mo}-${dd}`;
    }

    function setField(name, value) {
        setForm((f) => ({ ...f, [name]: value }));
    }

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const data = await getStudent(id);
                if (!data) throw new Error("Không tìm thấy học viên.");
                if (ignore) return;

                const pick = (obj, pascal, camel, def = "") =>
                    obj?.[pascal] ?? obj?.[camel] ?? def;

                const iso = anyToISO(
                    pick(data, "ngayBatDauHoc", "ngayBatDauHoc", "")
                    // BE bạn đang dùng camel cho trường này
                );

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
                console.error(e);
                setErrors([e.message || "Không tải được dữ liệu học viên."]);
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [id]);

    function validate() {
        const es = [];
        if (!form.StudentName?.trim()) es.push("Vui lòng nhập Tên học viên.");
        if (!form.ParentName?.trim()) es.push("Vui lòng nhập Tên phụ huynh.");
        if (!form.PhoneNumber?.trim()) es.push("Vui lòng nhập Số điện thoại.");
        if (!form.ngayBatDauHoc) es.push("Vui lòng nhập Ngày bắt đầu học (dd/mm/yyyy).");
        if (form.SoBuoiHocConLai < 0) es.push("Số buổi học còn lại không hợp lệ.");
        if (form.SoBuoiHocDaHoc < 0) es.push("Số buổi đã học không hợp lệ.");
        setErrors(es);
        return es.length === 0;
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await updateStudent(id, { ...form, ngayBatDauHoc: form.ngayBatDauHoc });
            navigate("/students");
        } catch (e) {
            console.error(e);
            setErrors(["Lưu thất bại. Vui lòng thử lại."]);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="content-wrapper">
                <section className="content-header"><h1>Đang tải...</h1></section>
            </div>
        );
    }

    return (
        <div >
            <section className="content-header">
                <h1>CẬP NHẬT HỌC VIÊN</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/students">Học viên</Link></li>
                    <li className="active">Cập nhật học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="row">
                    <div className="col-sm-12 col-md-12 col-lg-12">
                        <div className="box box-primary">
                            <div className="box-body">
                                {errors.length > 0 && (
                                    <div className="alert alert-danger">
                                        <ul style={{ marginBottom: 0 }}>
                                            {errors.map((err, i) => (<li key={i}>{err}</li>))}
                                        </ul>
                                    </div>
                                )}

                                <form onSubmit={onSubmit}>
                                    {/* Tên học viên */}
                                    <div className="form-group">
                                        <label htmlFor="StudentName">Tên học viên</label>
                                        <input
                                            id="StudentName"
                                            className={`form-control ${!form.StudentName?.trim() && errors.length ? "is-invalid" : ""}`}
                                            type="text"
                                            value={form.StudentName}
                                            onChange={(e) => setField("StudentName", e.target.value)}
                                            required
                                        />
                                    </div>

                                    {/* Tên phụ huynh */}
                                    <div className="form-group">
                                        <label htmlFor="ParentName">Tên phụ huynh</label>
                                        <input
                                            id="ParentName"
                                            className={`form-control ${!form.ParentName?.trim() && errors.length ? "is-invalid" : ""}`}
                                            type="text"
                                            value={form.ParentName}
                                            onChange={(e) => setField("ParentName", e.target.value)}
                                            required
                                        />
                                    </div>

                                    {/* Số điện thoại */}
                                    <div className="form-group">
                                        <label htmlFor="PhoneNumber">Số điện thoại</label>
                                        <input
                                            id="PhoneNumber"
                                            className={`form-control ${!form.PhoneNumber?.trim() && errors.length ? "is-invalid" : ""}`}
                                            type="tel"
                                            value={form.PhoneNumber}
                                            onChange={(e) => setField("PhoneNumber", e.target.value)}
                                            required
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

                                    {/* Ngày bắt đầu học (dd/MM/yyyy -> ISO yyyy-MM-dd) */}
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
                                            onBlur={() => {
                                                const iso = dmyToISO(ngayBatDauHocText);
                                                if (iso) setNgayBatDauHocText(isoToDMY(iso));
                                            }}
                                            required
                                        />
                                    </div>

                                    {/* Số buổi học còn lại */}
                                    <div className="form-group">
                                        <label htmlFor="SoBuoiHocConLai">Số buổi học còn lại</label>
                                        <input
                                            id="SoBuoiHocConLai"
                                            className={`form-control ${form.SoBuoiHocConLai < 0 && errors.length ? "is-invalid" : ""}`}
                                            type="number"
                                            min={0}
                                            value={form.SoBuoiHocConLai}
                                            onChange={(e) => setField("SoBuoiHocConLai", Number(e.target.value))}
                                            required
                                        />
                                    </div>

                                    {/* Số buổi đã học */}
                                    <div className="form-group">
                                        <label htmlFor="SoBuoiHocDaHoc">Số buổi đã học</label>
                                        <input
                                            id="SoBuoiHocDaHoc"
                                            className={`form-control ${form.SoBuoiHocDaHoc < 0 && errors.length ? "is-invalid" : ""}`}
                                            type="number"
                                            min={0}
                                            value={form.SoBuoiHocDaHoc}
                                            onChange={(e) => setField("SoBuoiHocDaHoc", Number(e.target.value))}
                                            required
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
                                            <option value={0}>Ngừng học</option>
                                        </select>
                                    </div>

                                    {/* Hành động */}
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>{" "}
                                    <Link to="/students" className="btn btn-default">Hủy</Link>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <style>{`
        .is-invalid { border: 2px solid #dc3545 !important; background-color: #f8d7da !important; }
      `}</style>
        </div>
    );
}

// Gắn route trong src/App.jsx
// <Route path="/students/:id/edit" element={<EditStudentPage />} />
