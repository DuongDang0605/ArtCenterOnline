// src/Template/Student/StudentProfilePage.jsx
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "./students";
import "./StudentProfilePage.css";

export default function StudentProfilePage() {
    const [me, setMe] = useState(null);
    const [form, setForm] = useState({
        studentName: "",
        parentName: "",
        phoneNumber: "",
        adress: "",
    });
    const [errs, setErrs] = useState({});
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    useEffect(() => {
        (async () => {
            try {
                const data = await getMyProfile();
                setMe(data);
                setForm({
                    studentName: data.StudentName ?? data.studentName ?? "",
                    parentName: data.ParentName ?? data.parentName ?? "",
                    phoneNumber: data.PhoneNumber ?? data.phoneNumber ?? "",
                    adress: data.Adress ?? data.adress ?? "",
                });
            } catch (e) {
                setMsg({ type: "warn", text: e?.message || "Không tải được hồ sơ" });
            }
        })();
    }, []);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setErrs((old) => ({ ...old, [name]: "" }));
    }

    function validate() {
        const next = {};
        if (!form.studentName?.trim()) next.studentName = "Vui lòng nhập họ tên học viên";
        if (!form.phoneNumber?.trim()) {
            next.phoneNumber = "Vui lòng nhập số điện thoại";
        } else if (!/^\d{9,11}$/.test(form.phoneNumber.trim())) {
            next.phoneNumber = "Số điện thoại không hợp lệ (9–11 chữ số)";
        }
        return next;
    }

    async function onSave() {
        const v = validate();
        setErrs(v);
        if (Object.keys(v).length > 0) {
            setMsg({ type: "warn", text: "Vui lòng kiểm tra lại các trường được đánh dấu." });
            return;
        }
        try {
            setSaving(true);
            setMsg({ type: "", text: "" });
            const updated = await updateMyProfile({
                studentName: form.studentName.trim(),
                parentName: form.parentName.trim(),
                phoneNumber: form.phoneNumber.trim(),
                adress: form.adress.trim(),
            });
            setMe(updated);
            setEditing(false);
            setMsg({ type: "ok", text: "Cập nhật thành công!" });
        } catch (e) {
            setMsg({
                type: "warn",
                text: e?.response?.data?.message || e?.message || "Lưu thất bại",
            });
        } finally {
            setSaving(false);
        }
    }

    if (!me) {
        return (
            <section className="content">
                <div className="box box-primary">
                    <div className="box-body" style={{ padding: 12 }}>
                        <i className="fa fa-spinner fa-spin" /> Đang tải…
                    </div>
                </div>
            </section>
        );
    }

    const studentId = String(me.StudentId ?? me.studentId ?? "");
    const soDaHoc = me.SoBuoiHocDaHoc ?? me.soBuoiHocDaHoc;
    const startDate = me.ngayBatDauHoc ?? "";
    const isActive = (me.Status ?? me.status) === 1;

    // Hàng field với cùng layout cho view/edit
    const Row = ({
        label,
        icon,
        name,
        value,
        onChange,
        readOnly,
        placeholder,
        required,
        maxLength,
        type = "text",
        help,
    }) => (
        <div className={`form-group ${errs[name] ? "has-error" : ""}`}>
            <label className="col-sm-2 control-label">{label}</label>
            <div className="col-sm-8">
                <div className="input-group">
                    <span className="input-group-addon">
                        <i className={`fa ${icon}`} />
                    </span>
                    <input
                        className="form-control"
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        readOnly={readOnly}
                        required={required}
                    />
                </div>
                {errs[name] ? (
                    <span className="help-block">{errs[name]}</span>
                ) : help ? (
                    <span className="help-block">{help}</span>
                ) : null}
            </div>
        </div>
    );

    return (
        <section className="content profile-form">
            <div className="box box-primary">
                {/* HEADER (bỏ narrow để bám trái) */}
                <div
                    className="box-header with-border"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                    <h3 className="box-title" style={{ fontSize: 18, fontWeight: 700 }}>Thông tin của tôi</h3>

                    {!editing ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                            <i className="fa fa-edit" /> Sửa thông tin
                        </button>
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                className="btn btn-default btn-sm"
                                disabled={saving}
                                onClick={() => {
                                    setEditing(false);
                                    setMsg({ type: "", text: "" });
                                    setErrs({});
                                    setForm({
                                        studentName: me.StudentName ?? me.studentName ?? "",
                                        parentName: me.ParentName ?? me.parentName ?? "",
                                        phoneNumber: me.PhoneNumber ?? me.phoneNumber ?? "",
                                        adress: me.Adress ?? me.adress ?? "",
                                    });
                                }}
                            >
                                Hủy
                            </button>
                            <button className="btn btn-success btn-sm" disabled={saving} onClick={onSave}>
                                {saving ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-save" />} Lưu
                            </button>
                        </div>
                    )}
                </div>

                {/* BODY (bỏ narrow để bám trái; bỏ quick-stats) */}
                <div className="box-body">
                    {msg.text ? (
                        <div
                            className={`callout ${msg.type === "ok" ? "callout-success" : "callout-warning"}`}
                            style={{ marginTop: 0, marginBottom: 16 }}
                        >
                            <p style={{ margin: 0 }}>{msg.text}</p>
                        </div>
                    ) : null}

                    {/* VIEW MODE: tất cả trường sát trái, cùng layout; Status & Số buổi đã học ở cuối */}
                    {!editing ? (
                        <form className="form-horizontal">
                            <Row label="Mã học viên" icon="fa-id-badge" name="studentId" value={studentId} readOnly />
                            <Row label="Họ tên" icon="fa-user" name="studentName" value={form.studentName || ""} readOnly />
                            <Row label="Tên phụ huynh" icon="fa-user" name="parentName" value={form.parentName || ""} readOnly />
                            <Row label="Số điện thoại" icon="fa-phone" name="phoneNumber" value={form.phoneNumber || ""} readOnly />
                            <Row label="Địa chỉ" icon="fa-map-marker" name="adress" value={form.adress || ""} readOnly />
                            <Row label="Bắt đầu học" icon="fa-calendar" name="startDate" value={startDate || ""} readOnly />

                            {/* ↓ Đưa xuống cuối theo yêu cầu */}
                            <Row
                                label="Trạng thái"
                                icon="fa-info-circle"
                                name="status"
                                value={isActive ? "Đang học" : "Nghỉ"}
                                readOnly
                            />
                            <Row
                                label="Số buổi đã học"
                                icon="fa-check-square-o"
                                name="soDaHoc"
                                value={soDaHoc != null ? String(soDaHoc) : ""}
                                readOnly
                            />
                        </form>
                    ) : (
                        // EDIT MODE: giữ layout, Status & Số buổi đã học vẫn readOnly và đặt cuối
                        <form
                            className="form-horizontal"
                            onSubmit={(e) => {
                                e.preventDefault();
                                onSave();
                            }}
                        >
                            <Row
                                label="Họ tên"
                                icon="fa-user"
                                name="studentName"
                                value={form.studentName}
                                onChange={onChange}
                                placeholder="Nhập họ tên học viên"
                                maxLength={200}
                                required
                            />
                            <Row
                                label="Tên phụ huynh"
                                icon="fa-user"
                                name="parentName"
                                value={form.parentName}
                                onChange={onChange}
                                placeholder="Nhập tên phụ huynh"
                                maxLength={200}
                            />
                            <Row
                                label="Số điện thoại"
                                icon="fa-phone"
                                name="phoneNumber"
                                value={form.phoneNumber}
                                onChange={onChange}
                                placeholder="VD: 0981234567"
                                maxLength={11}
                                help={!errs.phoneNumber ? "Chỉ nhập số, 9–11 chữ số." : undefined}
                            />
                            <Row
                                label="Địa chỉ"
                                icon="fa-map-marker"
                                name="adress"
                                value={form.adress}
                                onChange={onChange}
                                placeholder="Nhập địa chỉ liên hệ"
                                maxLength={255}
                            />

                            {/* ↓ Đưa xuống cuối theo yêu cầu */}


                            <div className="form-group" style={{ marginTop: 8 }}>
                                <div className="col-sm-offset-2 col-sm-10" style={{ display: "flex", gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn btn-default"
                                        disabled={saving}
                                        onClick={() => {
                                            setEditing(false);
                                            setMsg({ type: "", text: "" });
                                            setErrs({});
                                            setForm({
                                                studentName: me.StudentName ?? me.studentName ?? "",
                                                parentName: me.ParentName ?? me.parentName ?? "",
                                                phoneNumber: me.PhoneNumber ?? me.phoneNumber ?? "",
                                                adress: me.Adress ?? me.adress ?? "",
                                            });
                                        }}
                                    >
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn btn-success" disabled={saving}>
                                        {saving ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-save" />} Lưu
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
