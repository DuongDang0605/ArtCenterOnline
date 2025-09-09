/* eslint-disable no-unused-vars */
// src/Template/Class/AddClassPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createClass } from "./classes";
import { getTeachers } from "../Teacher/Teachers";
import { useAuth } from "../../auth/authCore";

export default function AddClassPage() {
    const navigate = useNavigate();
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const [form, setForm] = useState({
        className: "",
        dayStart: "",
        branch: "",
        status: 1,
        mainTeacherId: "",
    });
    const [teachers, setTeachers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Guard: chưa đăng nhập -> về login; không phải Admin -> báo lỗi và không load data
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
            return;
        }
        if (!isAdmin) {
            setError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
        }
    }, [isLoggedIn, isAdmin, navigate]);

    useEffect(() => {
        if (!isLoggedIn || !isAdmin) return;
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
    }, [isLoggedIn, isAdmin]);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: name === "status" ? Number(value) : value }));
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!isAdmin) {
            setError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            return;
        }
        setError(""); setSaving(true);
        try {
            await createClass({
                className: form.className.trim(),
                dayStart: form.dayStart || null,
                branch: form.branch.trim(),
                status: Number(form.status),
                mainTeacherId: form.mainTeacherId ? Number(form.mainTeacherId) : null,
            });
            navigate("/classes", { state: { flash: "Tạo lớp thành công!" } });
        } catch (err) {
            setError(err.userMessage || err.message || "Failed to create class");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Tạo lớp học mới</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/classes">Quản lý lớp học</Link></li>
                    <li className="active">Tạo mới lớp học</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Thông tin lớp học mới</h3>
                    </div>

                    {error && (
                        <div className="box-body">
                            <div className="alert alert-danger" style={{ whiteSpace: "pre-wrap" }}>{error}</div>
                        </div>
                    )}

                    {isAdmin ? (
                        <form className="form-horizontal" onSubmit={onSubmit}>
                            <div className="box-body">
                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Tên lớp</label>
                                    <div className="col-sm-10">
                                        <input type="text" className="form-control" name="className"
                                            value={form.className} onChange={onChange} required placeholder="e.g. Watercolor Basics" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Cơ sở</label>
                                    <div className="col-sm-10">
                                        <input type="text" className="form-control" name="branch"
                                            value={form.branch} onChange={onChange} placeholder="Campus / Facility name" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Trạng thái</label>
                                    <div className="col-sm-10">
                                        <label className="radio-inline">
                                            <input type="radio" name="status" value={1}
                                                checked={Number(form.status) === 1} onChange={onChange} /> Đang hoạt động
                                        </label>
                                        <label className="radio-inline" style={{ marginLeft: 15 }}>
                                            <input type="radio" name="status" value={0}
                                                checked={Number(form.status) === 0} onChange={onChange} /> Dừng hoạt động
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="box-footer">
                                <Link to="/classes" className="btn btn-default">Hủy</Link>
                                <button type="submit" className="btn btn-primary pull-right" disabled={saving}>
                                    {saving ? "Đang tạo..." : "Tạo lớp học mới"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="box-footer">
                            <button className="btn btn-default" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
