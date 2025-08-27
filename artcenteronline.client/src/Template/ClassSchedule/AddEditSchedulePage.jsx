// src/Template/ClassSchedule/AddEditSchedulePage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createSchedule, getSchedule, updateSchedule } from "./schedules";

const VI_DOW = [
    { v: 0, t: "Chủ nhật" },
    { v: 1, t: "Thứ 2" },
    { v: 2, t: "Thứ 3" },
    { v: 3, t: "Thứ 4" },
    { v: 4, t: "Thứ 5" },
    { v: 5, t: "Thứ 6" },
    { v: 6, t: "Thứ 7" },
];

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

    const [loading, setLoading] = useState(isEdit); // chỉ load khi edit
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // tải dữ liệu khi edit
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
                setErr(e?.message || "Không tải được dữ liệu.");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({
            ...f,
            [name]: type === "checkbox" ? checked : name === "dayOfWeek" ? Number(value) : value,
        }));
    };

    const validate = () => {
        // kiểm tra giờ: "HH:mm"
        const s = form.startTime;
        const e = form.endTime;
        if (!s || !e) return "Giờ bắt đầu/kết thúc không hợp lệ.";
        // so sánh bằng chuỗi "HH:mm" vẫn đúng thứ tự từ điển -> tạm dùng
        if (e <= s) return "Giờ kết thúc phải lớn hơn giờ bắt đầu.";
        return "";
    };

    const onSubmit = async (ev) => {
        ev.preventDefault();
        setErr("");

        const v = validate();
        if (v) {
            setErr(v);
            return;
        }

        const payload = {
            ...form,
            // chuẩn hoá thành "HH:mm:ss" để map TimeSpan
            startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
            endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
        };

        try {
            setSaving(true);
            if (isEdit) {
                await updateSchedule(id, payload);
            } else {
                await createSchedule(payload);
            }
            // chỉ điều hướng khi KHÔNG lỗi
            navigate(`/classes/${classId}/schedules`);
        } catch (e) {
            // hiện lỗi rõ ràng (409 từ server: “Lịch này đã tồn tại.”)
            const msg = (e?.message || "").trim();
            if (msg.includes("đã tồn tại") || msg.includes("Conflict")) {
                setErr("Lịch này đã tồn tại (trùng Lớp + Thứ + Giờ bắt đầu).");
            } else if (msg) {
                setErr(msg);
            } else {
                setErr("Không thể lưu. Vui lòng thử lại.");
            }
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
                            {err && !loading && (
                                <div className="alert alert-danger" role="alert" style={{ fontSize: "16px", fontWeight: "bold" }}>
                                    <i className="fa fa-exclamation-circle" style={{ marginRight: 6 }}></i>
                                    {err}
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
        </>
    );
}
