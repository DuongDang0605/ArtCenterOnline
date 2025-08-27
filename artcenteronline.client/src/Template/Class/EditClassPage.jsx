// src/Template/Class/EditClassPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getClass, updateClass } from "./classes";
import { getTeachers } from "../Teacher/Teachers"; // cần sẵn hàm getTeachers()

export default function EditClassPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        className: "",
        dayStart: "",
        branch: "",
        status: 1,
        mainTeacherId: "", // NEW
    });
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [data, ts] = await Promise.all([getClass(id), getTeachers()]);
                if (!alive) return;

                const date = data.dayStart ? new Date(data.dayStart) : null;
                const yyyyMMdd = date
                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                    : "";

                setForm({
                    className: data.className ?? "",
                    dayStart: yyyyMMdd,
                    branch: data.branch ?? "",
                    status: typeof data.status === "number" ? data.status : 1,
                    mainTeacherId: data.mainTeacherId ?? "", // NEW
                });
                setTeachers(Array.isArray(ts) ? ts : []);
            } catch (e) {
                setError(e.message || "Failed to load class");
            } finally {
                setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id]);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: name === "status" ? Number(value) : value }));
    }

    async function onSubmit(e) {
        e.preventDefault();
        setError(""); setSaving(true);
        try {
            await updateClass(Number(id), {
                className: form.className.trim(),
                dayStart: form.dayStart ? new Date(form.dayStart).toISOString() : null,
                branch: form.branch.trim(),
                status: Number(form.status),
                mainTeacherId: form.mainTeacherId ? Number(form.mainTeacherId) : null, // NEW
            });
            navigate("/classes", { state: { flash: "Cập nhật lớp thành công!" } });
        } catch (e) {
            setError(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <section className="content">
                <div className="box box-primary">
                    <div className="box-body">Loading...</div>
                </div>
            </section>
        );
    }

    return (
        <>
            <section className="content-header">
                <h1>Edit Class <small>ID #{id}</small></h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Home</Link></li>
                    <li><Link to="/classes">Classes</Link></li>
                    <li className="active">Edit</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Update information</h3>
                    </div>

                    {error && (
                        <div className="box-body">
                            <div className="alert alert-danger">{error}</div>
                        </div>
                    )}

                    <form className="form-horizontal" onSubmit={onSubmit}>
                        <div className="box-body">
                            <div className="form-group">
                                <label className="col-sm-2 control-label">Class Name</label>
                                <div className="col-sm-10">
                                    <input type="text" className="form-control" name="className"
                                        value={form.className} onChange={onChange} required placeholder="e.g. Watercolor Basics" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Start Date</label>
                                <div className="col-sm-4">
                                    <input type="date" className="form-control" name="dayStart"
                                        value={form.dayStart} onChange={onChange} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Branch</label>
                                <div className="col-sm-10">
                                    <input type="text" className="form-control" name="branch"
                                        value={form.branch} onChange={onChange} placeholder="Campus / Facility name" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label">Status</label>
                                <div className="col-sm-10">
                                    <label className="radio-inline">
                                        <input type="radio" name="status" value={1}
                                            checked={Number(form.status) === 1} onChange={onChange} /> Active
                                    </label>
                                    <label className="radio-inline" style={{ marginLeft: 15 }}>
                                        <input type="radio" name="status" value={0}
                                            checked={Number(form.status) === 0} onChange={onChange} /> Inactive
                                    </label>
                                </div>
                            </div>

                            {/* NEW: chọn giáo viên chính */}
                            <div className="form-group">
                                <label className="col-sm-2 control-label">Main Teacher</label>
                                <div className="col-sm-10">
                                    <select className="form-control" name="mainTeacherId"
                                        value={form.mainTeacherId} onChange={onChange}>
                                        <option value="">-- Chưa gán --</option>
                                        {teachers.map(t => (
                                            <option key={t.teacherId} value={t.teacherId}>
                                                {t.teacherName} {t.phoneNumber ? `(${t.phoneNumber})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="help-block">Đổi giáo viên chính không làm thay đổi các buổi đã chỉnh tay.</p>
                                </div>
                            </div>
                        </div>

                        <div className="box-footer">
                            <Link to="/classes" className="btn btn-default">Cancel</Link>
                            <button type="submit" className="btn btn-primary pull-right" disabled={saving}>
                                {saving ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}
