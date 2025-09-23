// src/Template/Student/StudentProfilePage.jsx
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "./students";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";
import "./StudentProfilePage.css";

export default function StudentProfilePage() {
    const { showError, showSuccess, Toasts } = useToasts();

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

    // Modal xác nhận giống AddClassPage
    const [confirmOpen, setConfirmOpen] = useState(false);

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
                showError(e?.message || "Không tải được hồ sơ.");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setErrs((old) => ({ ...old, [name]: "" }));
    }

    function validate() {
        const next = {};
        if (!form.studentName?.trim()) next.studentName = "Vui lòng nhập họ tên học viên.";
        if (!form.phoneNumber?.trim()) {
            next.phoneNumber = "Vui lòng nhập số điện thoại.";
        } else if (!/^\d{9,11}$/.test(form.phoneNumber.trim())) {
            next.phoneNumber = "Số điện thoại không hợp lệ (9–11 chữ số).";
        }
        return next;
    }

    function openConfirmSave() {
        const v = validate();
        setErrs(v);
        if (Object.keys(v).length > 0) {
            showError("Vui lòng kiểm tra lại các trường được đánh dấu.");
            return;
        }
        setConfirmOpen(true);
    }

    async function doSave() {
        const v = validate();
        if (Object.keys(v).length > 0) {
            setErrs(v);
            showError("Vui lòng kiểm tra lại các trường được đánh dấu.");
            setConfirmOpen(false);
            return;
        }

        try {
            setSaving(true);
            const updated = await updateMyProfile({
                studentName: form.studentName.trim(),
                parentName: form.parentName.trim(),
                phoneNumber: form.phoneNumber.trim(),
                adress: form.adress.trim(),
            });
            setMe(updated);
            setEditing(false);
            showSuccess("Cập nhật hồ sơ thành công.");
        } catch (e) {
            showError(extractErr(e) || "Lưu thất bại.");
        } finally {
            setSaving(false);
            setConfirmOpen(false);
        }
    }

    if (!me) {
        return (
            <>
                <section className="content">
                    <div className="box box-primary">
                        <div className="box-body" style={{ padding: 12 }}>
                            <i className="fa fa-spinner fa-spin" /> Đang tải…
                        </div>
                    </div>
                </section>
                <Toasts />
            </>
        );
    }

    const studentId = String(me.StudentId ?? me.studentId ?? "");
    const soDaHoc = me.SoBuoiHocDaHoc ?? me.soBuoiHocDaHoc;
    const soConLai = me.SoBuoiHocConLai ?? me.soBuoiHocConLai;
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
        <div>
            <style>{`
 /* Gói form để override nhẹ mà không ảnh hưởng trang khác */
.profile-form .form-group { margin-bottom: 14px; }
.profile-form .control-label { font-weight: 600; color: #333; font-size: 14px; }
.profile-form .form-control { height: 40px; font-size: 15px; border-radius: 4px; border-color: #d2d6de; box-shadow: none; transition: border-color .2s ease, box-shadow .2s ease; }
.profile-form .form-control:focus { border-color: #3c8dbc; box-shadow: 0 0 0 2px rgba(60,141,188,.15); }
.profile-form .input-group-addon { background: #f7f7f7; border-color: #d2d6de; min-width: 42px; font-size: 14px; color: #666; }
.profile-form .form-control-static { font-size: 15px; padding-top: 8px; color: #111; }
.profile-form .label { display: inline-block; padding: 5px 10px; }
.profile-form .quick-stats .badge { padding: 6px 10px; font-weight: 600; }
.profile-form .action-row { display: flex; gap: 8px; }
.profile-form .narrow { max-width: 820px; width: 100%; margin: 0 auto; }
@media (max-width: 767px) {
  .profile-form .control-label { text-align: left !important; margin-bottom: 6px; }
}
.profile-form .input-group-addon .fa-id-badge { color: #dd4b39 !important; }
.profile-form .input-group-addon .fa-user { color: #3c8dbc !important; }
.profile-form .input-group-addon .fa-phone { color: #00a65a !important; }
.profile-form .input-group-addon .fa-map-marker { color: #f39c12 !important; }
.profile-form .input-group-addon .fa-calendar { color: #605ca8 !important; }
.profile-form .input-group-addon .fa-info-circle { color: #00c0ef !important; }
.profile-form .input-group-addon .fa-check-square-o { color: #00a65a !important; }
`}</style>

            <section className="content profile-form">
                <div className="box box-primary">
                    {/* HEADER */}
                    <div
                        className="box-header with-border"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                        <h3 className="box-title" style={{ fontSize: 18, fontWeight: 700 }}>
                            Thông tin của tôi
                        </h3>

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
                                <button
                                    className="btn btn-success btn-sm"
                                    disabled={saving}
                                    onClick={openConfirmSave}
                                >
                                    {saving ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-save" />}{" "}
                                    Lưu
                                </button>
                            </div>
                        )}
                    </div>

                    {/* BODY */}
                    <div className="box-body">
                        {/* VIEW MODE */}
                        {!editing ? (
                            <form className="form-horizontal">
                                <Row label="Mã học viên" icon="fa-id-badge" name="studentId" value={studentId} readOnly />
                                <Row label="Họ tên" icon="fa-user" name="studentName" value={form.studentName || ""} readOnly />
                                <Row label="Tên phụ huynh" icon="fa-user" name="parentName" value={form.parentName || ""} readOnly />
                                <Row label="Số điện thoại" icon="fa-phone" name="phoneNumber" value={form.phoneNumber || ""} readOnly />
                                <Row label="Địa chỉ" icon="fa-map-marker" name="adress" value={form.adress || ""} readOnly />
                                <Row label="Bắt đầu học" icon="fa-calendar" name="startDate" value={startDate || ""} readOnly />

                                {/* Trạng thái + Số buổi */}
                                <Row label="Trạng thái" icon="fa-info-circle" name="status" value={isActive ? "Đang học" : "Nghỉ"} readOnly />
                                <Row label="Số buổi đã học" icon="fa-check-square-o" name="soDaHoc" value={soDaHoc != null ? String(soDaHoc) : ""} readOnly />
                                <Row label="Số buổi đã đóng" icon="fa-check-square-o" name="soConLai" value={soConLai != null ? String(soConLai) : ""} readOnly />
                            </form>
                        ) : (
                            // EDIT MODE
                            <form
                                className="form-horizontal"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    openConfirmSave();
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

                                <div className="form-group" style={{ marginTop: 8 }}>
                                    <div className="col-sm-offset-2 col-sm-10" style={{ display: "flex", gap: 8 }}>
                                        <button
                                            type="button"
                                            className="btn btn-default"
                                            disabled={saving}
                                            onClick={() => {
                                                setEditing(false);
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

            {/* Modal xác nhận ở giữa màn hình, tiêu đề in đậm (đồng bộ AddClassPage) */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận cập nhật hồ sơ"
                message={`Lưu thay đổi cho "${form.studentName?.trim() || "(chưa nhập tên)"}"?`}
                details="Bạn có thể chỉnh sửa lại sau nếu cần."
                confirmText="Lưu thay đổi"
                cancelText="Xem lại"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doSave}
                busy={saving}
            />

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </div>
    );
}
