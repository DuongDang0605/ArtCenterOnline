/* eslint-disable no-unused-vars */
// src/Template/Class/EditClassPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getClass, updateClass } from "./classes";
import { getTeachers } from "../Teacher/Teachers";
import { useAuth } from "../../auth/authCore";

export default function EditClassPage() {
    const { id } = useParams();
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Guard
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
        if (!isLoggedIn || !isAdmin) { setLoading(false); return; }
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
                    mainTeacherId: data.mainTeacherId ?? "",
                });
                setTeachers(Array.isArray(ts) ? ts : []);
            } catch (e) {
                const res = e?.response;
                const msg =
                    e?.userMessage ||
                    res?.data?.message ||
                    res?.data?.detail ||
                    res?.data?.title ||
                    (typeof res?.data === "string" ? res.data : null) ||
                    e?.message ||
                    "Failed to load class";
                // 401 → về login
                if (res?.status === 401) {
                    navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                    return;
                }
                setError(String(msg));
            } finally {
                setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id, isLoggedIn, isAdmin, navigate]);

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
            await updateClass(Number(id), {
                className: form.className.trim(),
                dayStart: form.dayStart ? new Date(form.dayStart).toISOString() : null,
                branch: form.branch.trim(),
                status: Number(form.status),
                mainTeacherId: form.mainTeacherId ? Number(form.mainTeacherId) : null,
            });
            navigate("/classes", { state: { flash: "Cập nhật lớp thành công!" }, replace: true });
        } catch (e) {
            const res = e?.response;
            if (res?.status === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            let msg =
                e?.userMessage ||
                res?.data?.message ||
                res?.data?.detail ||
                res?.data?.title ||
                (typeof res?.data === "string" ? res.data : null) ||
                e?.message ||
                "Failed to save";

            if (!e?.userMessage && res?.data?.errors && typeof res.data.errors === "object") {
                const lines = [];
                for (const [field, arr] of Object.entries(res.data.errors)) {
                    (arr || []).forEach((x) => lines.push(`${field}: ${x}`));
                }
                if (lines.length) msg = lines.join("\n");
            }
            setError(String(msg));
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
                <h1>Sửa thông tin Lớp học <small>ID #{id}</small></h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/classes">Quản lý lớp học</Link></li>
                    <li className="active">Sửa thông tin lớp</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
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
                                <Link to="/classes" className="btn btn-default">Hủy thay đổi</Link>
                                <button type="submit" className="btn btn-primary pull-right" disabled={saving}>
                                    {saving ? "Saving..." : "Save changes"}
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
