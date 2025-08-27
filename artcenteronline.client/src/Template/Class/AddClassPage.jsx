// src/Template/Class/AddClassPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createClass } from "./classes";
import { getTeachers } from "../Teacher/Teachers"; // cần sẵn hàm getTeachers()

export default function AddClassPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        className: "",
        dayStart: "",
        branch: "",
        status: 1,
        mainTeacherId: "",    // NEW
    });
    const [teachers, setTeachers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const ts = await getTeachers();
                if (alive) setTeachers(Array.isArray(ts) ? ts : []);
            } catch (e) {
                if (alive) setError(e?.message || "Failed to load teachers");
            }
        })();
        return () => { alive = false; };
    }, []);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: name === "status" ? Number(value) : value }));
    }

    async function onSubmit(e) {
        e.preventDefault();
        setError(""); setSaving(true);
        try {
            await createClass({
                className: form.className.trim(),
                dayStart: form.dayStart ? new Date(form.dayStart).toISOString() : null,
                branch: form.branch.trim(),
                status: Number(form.status),
                mainTeacherId: form.mainTeacherId ? Number(form.mainTeacherId) : null, // NEW
            });
            navigate("/classes", { state: { flash: "Tạo lớp thành công!" } });
        } catch (err) {
            setError(err.message || "Failed to create class");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Add Class</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Home</Link></li>
                    <li><Link to="/classes">Classes</Link></li>
                    <li className="active">Add</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">New class information</h3>
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
                                    <p className="help-block">Mỗi lớp có 1 giáo viên chính. Có thể đổi sau tại trang Edit.</p>
                                </div>
                            </div>
                        </div>

                        <div className="box-footer">
                            <Link to="/classes" className="btn btn-default">Cancel</Link>
                            <button type="submit" className="btn btn-primary pull-right" disabled={saving}>
                                {saving ? "Creating..." : "Create class"}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}
