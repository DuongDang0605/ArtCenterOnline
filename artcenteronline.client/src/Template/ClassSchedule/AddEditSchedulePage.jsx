// src/Template/ClassSchedule/AddEditSchedulePage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createSchedule, getSchedule, updateSchedule, checkStudentOverlapForSchedule } from "./schedules";
import OverlapWarningModal from "../../component/OverlapWarningModal";

const VI_DOW = [
    { v: 0, t: "Chủ nhật" },
    { v: 1, t: "Thứ 2" },
    { v: 2, t: "Thứ 3" },
    { v: 3, t: "Thứ 4" },
    { v: 4, t: "Thứ 5" },
    { v: 5, t: "Thứ 6" },
    { v: 6, t: "Thứ 7" },
];

function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}
function endOfMonthYMD(fromStr) {
    const [y, m] = fromStr.split("-").map(Number);
    const last = new Date(y, m, 0); // day 0 of next month = last day current month
    const yy = last.getFullYear();
    const mm = String(last.getMonth() + 1).padStart(2, "0");
    const dd = String(last.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

export default function AddEditSchedulePage({ mode = "create" }) {
    const { classId, id } = useParams();
    const navigate = useNavigate();
    const isEdit = mode === "edit";

    const [form, setForm] = useState({
        classID: Number(classId),
        dayOfWeek: 1,
        startTime: "18:00",
        endTime: "20:00",
        note: "",
        isActive: true,
    });

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // Cảnh báo trùng học sinh
    const [warnOpen, setWarnOpen] = useState(false);
    const [warnings, setWarnings] = useState([]);
    const [pendingPayload, setPendingPayload] = useState(null);

    // nạp dữ liệu khi edit
    useEffect(() => {
        if (!isEdit) return;
        (async () => {
            try {
                const data = await getSchedule(id);
                setForm({
                    classID: data.classID,
                    dayOfWeek: data.dayOfWeek,
                    startTime: (data.startTime || "").slice(0, 5), // "HH:mm"
                    endTime: (data.endTime || "").slice(0, 5),
                    note: data.note || "",
                    isActive: !!data.isActive,
                });
            } catch (e) {
                const res = e?.response;
                const msg =
                    e?.userMessage ||
                    res?.data?.message ||
                    res?.data?.detail ||
                    res?.data?.title ||
                    (typeof res?.data === "string" ? res.data : null) ||
                    e?.message ||
                    "Không thể tải dữ liệu.";
                setErr(String(msg));
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({
            ...f,
            [name]:
                type === "checkbox" ? checked : name === "dayOfWeek" ? Number(value) : value,
        }));
    };

    const validate = () => {
        const s = form.startTime;
        const e = form.endTime;
        if (!s || !e) return "Giờ bắt đầu/kết thúc không hợp lệ.";
        // so sánh "HH:mm"
        if (e <= s) return "Giờ kết thúc phải lớn hơn giờ bắt đầu.";
        return "";
    };

    const onSubmit = async (ev) => {
        ev.preventDefault();
        setErr("");

        const v = validate();
        if (v) return setErr(v);

        // payload chuẩn cho CREATE/UPDATE
        const payload = {
            ...form,
            startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime, // "HH:mm:ss"
            endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
        };

        try {
            // 1) Chỉ preflight khi EDIT (endpoint BE theo id)
            if (isEdit) {
                const preflight = {
                    // Dùng chữ hoa để khớp model BE, nhưng binder cũng case-insensitive
                    ClassID: Number(form.classID ?? classId),
                    DayOfWeek: Number(form.dayOfWeek),
                    StartTime: payload.startTime,
                    EndTime: payload.endTime,
                    Note: form.note || null,
                    IsActive: !!form.isActive,
                };
                const from = todayYMD();
                const to = endOfMonthYMD(from);
                const list = await checkStudentOverlapForSchedule(Number(id), preflight, { from, to });
                if (list.length > 0) {
                    setWarnings(list);
                    setPendingPayload(payload);
                    setWarnOpen(true);
                    return; // dừng lại, chờ xác nhận
                }
            }

            // 2) Không có cảnh báo (hoặc create) → lưu luôn
            setSaving(true);
            if (isEdit) {
                await updateSchedule(id, payload);
                navigate(`/classes/${classId}/schedules`, {
                    state: { success: "Cập nhật lịch học thành công!" },
                    replace: true,
                });
            } else {
                await createSchedule(payload);
                navigate(`/classes/${classId}/schedules`, {
                    state: { success: "Tạo lịch học thành công!" },
                    replace: true,
                });
            }
        } catch (e) {
            const res = e?.response;
            let msg =
                e?.userMessage ||
                res?.data?.message ||
                res?.data?.detail ||
                res?.data?.title ||
                (typeof res?.data === "string" ? res.data : null) ||
                e?.message;

            // gom lỗi ModelState nếu có
            if (!e?.userMessage && res?.data?.errors && typeof res.data.errors === "object") {
                const lines = [];
                for (const [field, arr] of Object.entries(res.data.errors)) {
                    (arr || []).forEach((x) => lines.push(`${field}: ${x}`));
                }
                if (lines.length) msg = lines.join("\n");
            }
            setErr(String(msg || "Không thể lưu. Vui lòng thử lại."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>{isEdit ? "Sửa lịch học" : "Thêm lịch học"} · Lớp #{classId}</h1>
                <ol className="breadcrumb">
                    <li>
                        <a href="#">
                            <i className="fa fa-dashboard" /> Home
                        </a>
                    </li>
                    <li>
                        <Link to="/classes">Class</Link>
                    </li>
                    <li>
                        <Link to={`/classes/${classId}/schedules`}>Schedules</Link>
                    </li>
                    <li className="active">{isEdit ? "Edit" : "New"}</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">{isEdit ? "Cập nhật" : "Tạo mới"}</h3>
                    </div>

                    <form onSubmit={onSubmit} noValidate>
                        <div className="box-body">
                            {loading && <p className="text-muted">Đang tải…</p>}

                            {err && (
                                <div className="alert alert-danger" role="alert" style={{ fontSize: "16px", fontWeight: "bold" }}>
                                    <i className="fa fa-exclamation-circle" style={{ marginRight: 6 }} />
                                    <span style={{ whiteSpace: "pre-wrap" }}>{err}</span>
                                </div>
                            )}

                            {!loading && (
                                <>
                                    <div className="form-group">
                                        <label>Thứ trong tuần</label>
                                        <select
                                            name="dayOfWeek"
                                            className="form-control"
                                            value={form.dayOfWeek}
                                            onChange={onChange}
                                            required
                                        >
                                            {VI_DOW.map((o) => (
                                                <option key={o.v} value={o.v}>
                                                    {o.t}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="row">
                                        <div className="col-xs-6">
                                            <div className="form-group">
                                                <label>Giờ bắt đầu</label>
                                                <input
                                                    type="time"
                                                    className="form-control"
                                                    name="startTime"
                                                    value={form.startTime}
                                                    onChange={onChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="col-xs-6">
                                            <div className="form-group">
                                                <label>Giờ kết thúc</label>
                                                <input
                                                    type="time"
                                                    className="form-control"
                                                    name="endTime"
                                                    value={form.endTime}
                                                    onChange={onChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Ghi chú</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="note"
                                            value={form.note}
                                            onChange={onChange}
                                            placeholder="Phòng A101 / Online..."
                                        />
                                    </div>

                                    <div className="checkbox">
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="isActive"
                                                checked={form.isActive}
                                                onChange={onChange}
                                            />{" "}
                                            Đang áp dụng (Active)
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="box-footer">
                            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                                <i className="fa fa-save" /> {saving ? "Đang lưu..." : "Lưu"}
                            </button>
                            <Link
                                to={`/classes/${classId}/schedules`}
                                className="btn btn-default"
                                style={{ marginLeft: 8 }}
                                onClick={(e) => saving && e.preventDefault()}
                            >
                                Huỷ
                            </Link>
                        </div>
                    </form>
                </div>
            </section>

            {/* Modal cảnh báo trùng học sinh (EDIT) */}
            <OverlapWarningModal
                open={warnOpen}
                warnings={warnings}
                title="Cảnh báo trùng học sinh (lịch mẫu)"
                onCancel={() => setWarnOpen(false)}
                onConfirm={async () => {
                    try {
                        setSaving(true);
                        await updateSchedule(id, pendingPayload || {});
                        setWarnOpen(false);
                        navigate(`/classes/${classId}/schedules`, {
                            state: { success: "Cập nhật lịch học thành công!" },
                            replace: true,
                        });
                    } catch (e) {
                        const res = e?.response;
                        const msg =
                            e?.userMessage ||
                            res?.data?.message ||
                            res?.data?.detail ||
                            res?.data?.title ||
                            (typeof res?.data === "string" ? res.data : null) ||
                            e?.message ||
                            "Có lỗi xảy ra khi lưu.";
                        setErr(String(msg));
                    } finally {
                        setSaving(false);
                    }
                }}
            />
        </>
    );
}
