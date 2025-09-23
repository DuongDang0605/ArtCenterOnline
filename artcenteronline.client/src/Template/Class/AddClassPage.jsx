/* eslint-disable no-unused-vars */
// src/Template/Class/AddClassPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createClass } from "./classes";
import { getTeachers } from "../Teacher/Teachers";
import { useAuth } from "../../auth/authCore";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function AddClassPage() {
    const navigate = useNavigate();
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const { showError, showSuccess, Toasts } = useToasts();

    const [form, setForm] = useState({
        className: "",
        dayStart: "",
        branch: "",
        status: 1,
        mainTeacherId: "",
    });
    const [teachers, setTeachers] = useState([]);
    const [saving, setSaving] = useState(false);

    // Modal xác nhận
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Guard
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
            return;
        }
        if (!isAdmin) {
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, isAdmin]);

    useEffect(() => {
        if (!isLoggedIn || !isAdmin) return;
        let alive = true;
        (async () => {
            try {
                const ts = await getTeachers();
                if (alive) setTeachers(Array.isArray(ts) ? ts : []);
            } catch (e) {
                if (alive) showError(extractErr(e) || "Không tải được danh sách giáo viên.");
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, isAdmin]);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: name === "status" ? Number(value) : value }));
    }

    function validate() {
        if (!form.className.trim()) return "Vui lòng nhập Tên lớp.";
        if (form.branch && form.branch.length > 100) return "Tên cơ sở quá dài (tối đa 100 ký tự).";
        const st = Number(form.status);
        if (st !== 0 && st !== 1) return "Trạng thái không hợp lệ.";
        if (form.mainTeacherId && isNaN(Number(form.mainTeacherId))) return "Giáo viên chính không hợp lệ.";
        return "";
    }

    function onSubmit(e) {
        e.preventDefault();
        const v = validate();
        if (v) { showError(v); return; }
        setConfirmOpen(true);
    }

    async function doCreate() {
        if (!isAdmin) {
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            return;
        }
        const v = validate();
        if (v) { showError(v); return; }

        setSaving(true);
        try {
            await createClass({
                className: form.className.trim(),
                dayStart: form.dayStart || null,
                branch: form.branch.trim(),
                status: Number(form.status),
                mainTeacherId: form.mainTeacherId ? Number(form.mainTeacherId) : null,
            });
            // thành công: điều hướng và để trang đích show success (giống Schedule)
            navigate("/classes", { state: { notice: "Tạo lớp thành công!" } });
        } catch (e) {
            showError(extractErr(e) || "Failed to create class");
        } finally {
            setSaving(false);
            setConfirmOpen(false);
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

                    {isAdmin ? (
                        <form className="form-horizontal" onSubmit={onSubmit}>
                            <div className="box-body">
                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Tên lớp</label>
                                    <div className="col-sm-10">
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="className"
                                            value={form.className}
                                            onChange={onChange}
                                            required
                                            placeholder="e.g. Watercolor Basics"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Cơ sở</label>
                                    <div className="col-sm-10">
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="branch"
                                            value={form.branch}
                                            onChange={onChange}
                                            placeholder="Campus / Facility name"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label">Trạng thái</label>
                                    <div className="col-sm-10">
                                        <label className="radio-inline">
                                            <input
                                                type="radio"
                                                name="status"
                                                value={1}
                                                checked={Number(form.status) === 1}
                                                onChange={onChange}
                                            />{" "}
                                            Đang hoạt động
                                        </label>
                                        <label className="radio-inline" style={{ marginLeft: 15 }}>
                                            <input
                                                type="radio"
                                                name="status"
                                                value={0}
                                                checked={Number(form.status) === 0}
                                                onChange={onChange}
                                            />{" "}
                                            Dừng hoạt động
                                        </label>
                                    </div>
                                </div>

                                {/* Nếu cần dropdown giáo viên chính, mở comment này:
                <div className="form-group">
                  <label className="col-sm-2 control-label">Giáo viên chính</label>
                  <div className="col-sm-10">
                    <select
                      className="form-control"
                      name="mainTeacherId"
                      value={form.mainTeacherId}
                      onChange={onChange}
                    >
                      <option value="">-- Không chọn --</option>
                      {teachers.map(t => {
                        const idv = t.teacherId ?? t.TeacherId;
                        const name = t.teacherName ?? t.fullName ?? t.FullName ?? `(GV #${idv})`;
                        const st = (t.status ?? t.Status ?? (t.isActive ? 1 : 0));
                        const disabled = st !== 1;
                        return (
                          <option key={idv} value={idv} disabled={disabled}>
                            {name}{disabled ? " [Ngừng]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div> */}
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

            {/* Modal xác nhận ở giữa màn hình, tiêu đề in đậm */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận tạo lớp học"
                message={`Tạo lớp "${form.className.trim() || "(chưa đặt tên)"}"?`}
                details="Bạn có thể chỉnh sửa thông tin lớp sau khi tạo."
                confirmText="Tạo lớp"
                cancelText="Xem lại"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doCreate}
                busy={saving}
            />

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
