import React, { useMemo, useState } from "react";
import { useAuth } from "../../auth/authCore";
import { updateTeacher } from "../Teacher/Teachers";
import { updateUser, changePasswordMe } from "../User/Users"; // <-- dùng hàm mới

export default function ProfilePage() {
    const auth = useAuth();
    const roles = auth?.roles ?? [];
    const isTeacher = roles.includes("Teacher");
    const isAdmin = roles.includes("Admin");
    const isStudent = roles.includes("Student");

    const myTeacherId = useMemo(
        () =>
            auth?.user?.teacherId ??
            auth?.user?.TeacherId ??
            auth?.user?.teacher?.teacherId ??
            auth?.user?.teacher?.TeacherId ??
            null,
        [auth?.user]
    );

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    // ----- Teacher form -----
    const [tFullName, setTFullName] = useState(auth?.user?.fullName ?? "");
    const [tPhone, setTPhone] = useState(auth?.user?.phoneNumber ?? "");
    const [savingTeacher, setSavingTeacher] = useState(false);

    // ----- Account (Admin/Teacher) -----
    const [aEmail, setAEmail] = useState(auth?.user?.email ?? "");
    const [aPassword, setAPassword] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);

    // ----- Student change password -----
    const [curPwd, setCurPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [newPwd2, setNewPwd2] = useState("");
    const [savingStudentPwd, setSavingStudentPwd] = useState(false);

    const onUpdateTeacher = async (e) => {
        e.preventDefault(); setMsg(""); setErr("");
        if (!myTeacherId) return setErr("Tài khoản chưa được liên kết Teacher.");
        try {
            setSavingTeacher(true);
            await updateTeacher(myTeacherId, {
                TeacherName: tFullName, PhoneNumber: tPhone,
            });
            auth?.updateUser?.((u) => ({ ...u, fullName: tFullName, phoneNumber: tPhone }));
            setMsg("Đã cập nhật thông tin giáo viên.");
        } catch (ex) {
            setErr(ex?.message || "Cập nhật giáo viên thất bại");
        } finally { setSavingTeacher(false); }
    };

    const onUpdateAccount = async (e) => {
        e.preventDefault(); setMsg(""); setErr("");
        const userId = auth?.user?.userId ?? auth?.user?.UserId ?? null;
        if (!userId) return setErr("Không xác định được UserId.");
        try {
            setSavingAccount(true);
            await updateUser(userId, { Email: aEmail, Password: aPassword || undefined });
            auth?.updateUser?.((u) => ({ ...u, email: aEmail }));
            setMsg("Đã cập nhật tài khoản.");
            setAPassword("");
        } catch (ex) {
            setErr(ex?.response?.data?.message || ex?.message || "Cập nhật tài khoản thất bại");
        } finally { setSavingAccount(false); }
    };

    const onStudentChangePassword = async (e) => {
        e.preventDefault(); setMsg(""); setErr("");
        if (!curPwd.trim()) return setErr("Vui lòng nhập mật khẩu hiện tại.");
        if (!newPwd || newPwd.length < 6) return setErr("Mật khẩu mới phải ≥ 6 ký tự.");
        if (newPwd !== newPwd2) return setErr("Xác nhận mật khẩu mới không khớp.");
        try {
            setSavingStudentPwd(true);
            await changePasswordMe({ currentPassword: curPwd, newPassword: newPwd });
            setMsg("Đổi mật khẩu thành công.");
            setCurPwd(""); setNewPwd(""); setNewPwd2("");
        } catch (ex) {
            const data = ex?.response?.data;
            const m = (typeof data === "string") ? data : (data?.message || data?.detail);
            setErr(m || ex?.message || "Đổi mật khẩu thất bại");
        } finally { setSavingStudentPwd(false); }
    };

    return (
        <>
            <section className="content-header">
                <h1>Hồ sơ cá nhân</h1>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Thông tin cơ bản</h3>
                    </div>
                    <div className="box-body">
                        <div className="row">
                            <div className="col-sm-6">
                                <p><b>Họ tên:</b> {auth?.user?.fullName ?? "—"}</p>
                                <p><b>Email:</b> {auth?.user?.email ?? "—"}</p>
                                <p><b>Vai trò:</b> {roles.length ? roles.join(", ") : "—"}</p>
                            </div>
                            <div className="col-sm-6">
                                {myTeacherId ? <p><b>TeacherId:</b> {myTeacherId}</p> : null}
                                {auth?.user?.userId ? <p><b>UserId:</b> {auth.user.userId}</p> : null}
                            </div>
                        </div>
                        {err && <div className="alert alert-danger" style={{ marginTop: 10 }}>{err}</div>}
                        {msg && <div className="alert alert-success" style={{ marginTop: 10 }}>{msg}</div>}
                    </div>
                </div>

                {isTeacher && (
                    <div className="box box-info">
                        <div className="box-header with-border"><h3 className="box-title">Cập nhật thông tin giáo viên</h3></div>
                        <form className="box-body" onSubmit={onUpdateTeacher}>
                            {!myTeacherId && <div className="alert alert-warning">Tài khoản chưa gắn TeacherId — liên hệ Admin để liên kết.</div>}
                            <div className="form-group">
                                <label>Họ tên</label>
                                <input className="form-control" value={tFullName} onChange={(e) => setTFullName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Số điện thoại</label>
                                <input className="form-control" value={tPhone} onChange={(e) => setTPhone(e.target.value)} />
                            </div>
                            <button className="btn btn-info" disabled={savingTeacher || !myTeacherId}>
                                {savingTeacher ? "Đang lưu..." : "Cập nhật hồ sơ giáo viên"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Admin/Teacher cập nhật tài khoản (giữ như cũ) */}
                {(isAdmin || isTeacher) && (
                    <div className="box box-warning">
                        <div className="box-header with-border"><h3 className="box-title">Cập nhật tài khoản</h3></div>
                        <form className="box-body" onSubmit={onUpdateAccount}>
                            <div className="form-group">
                                <label>Email</label>
                                <input className="form-control" type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Mật khẩu mới (tuỳ chọn)</label>
                                <input className="form-control" type="password" value={aPassword} onChange={(e) => setAPassword(e.target.value)} />
                            </div>
                            <button className="btn btn-warning" disabled={savingAccount}>
                                {savingAccount ? "Đang lưu..." : "Cập nhật tài khoản"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Student đổi mật khẩu của chính mình */}
                {isStudent && (
                    <div className="box box-danger">
                        <div className="box-header with-border"><h3 className="box-title">Đổi mật khẩu</h3></div>
                        <form className="box-body" onSubmit={onStudentChangePassword}>
                            <div className="form-group">
                                <label>Mật khẩu hiện tại</label>
                                <input className="form-control" type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Mật khẩu mới (≥ 6 ký tự)</label>
                                <input className="form-control" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Nhập lại mật khẩu mới</label>
                                <input className="form-control" type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} required />
                            </div>
                            <button className="btn btn-danger" disabled={savingStudentPwd}>
                                {savingStudentPwd ? "Đang đổi..." : "Đổi mật khẩu"}
                            </button>
                        </form>
                    </div>
                )}
            </section>
        </>
    );
}
