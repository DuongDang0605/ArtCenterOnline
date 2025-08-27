import React, { useMemo, useState } from "react";
import { useAuth } from "../../auth/authCore";
import { updateTeacher } from "../Teacher/Teachers"; // đã có ở TeacherPage
import { updateUser } from "../User/Users";         // API cập nhật tài khoản (email/mật khẩu)

export default function ProfilePage() {
    const auth = useAuth();
    const roles = auth?.roles ?? [];
    const isTeacher = roles.includes("Teacher");
    const isAdmin = roles.includes("Admin");

    // hỗ trợ cả teacherId/TeacherId do BE/FE có thể khác casing
    const myTeacherId = useMemo(
        () =>
            auth?.user?.teacherId ??
            auth?.user?.TeacherId ??
            auth?.user?.teacher?.teacherId ??
            auth?.user?.teacher?.TeacherId ??
            null,
        [auth?.user]
    );

    // state hiển thị
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    // form cập nhật Teacher
    const [tFullName, setTFullName] = useState(auth?.user?.fullName ?? "");
    const [tPhone, setTPhone] = useState(auth?.user?.phoneNumber ?? "");
    const [savingTeacher, setSavingTeacher] = useState(false);

    // form cập nhật Account
    const [aEmail, setAEmail] = useState(auth?.user?.email ?? "");
    const [aPassword, setAPassword] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);

    const onUpdateTeacher = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        if (!myTeacherId) {
            setErr("Tài khoản chưa được liên kết Teacher.");
            return;
        }
        try {
            setSavingTeacher(true);
            await updateTeacher(myTeacherId, {
                TeacherName: tFullName,
                PhoneNumber: tPhone,
                // giữ status hiện tại nếu API yêu cầu (Backend của bạn đã xử lý mặc định)
            });

            // cập nhật lại context hiển thị tên
            auth?.updateUser?.((u) => ({ ...u, fullName: tFullName, phoneNumber: tPhone }));

            setMsg("Đã cập nhật thông tin giáo viên.");
        } catch (ex) {
            setErr(ex?.message || "Cập nhật giáo viên thất bại");
        } finally {
            setSavingTeacher(false);
        }
    };

    const onUpdateAccount = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        const userId =
            auth?.user?.userId ??
            auth?.user?.UserId ??
            null;

        if (!userId) {
            setErr("Không xác định được UserId.");
            return;
        }

        try {
            setSavingAccount(true);
            await updateUser(userId, {
                Email: aEmail,
                Password: aPassword || undefined, // để trống thì backend có thể bỏ qua
            });

            // đồng bộ lại context
            auth?.updateUser?.((u) => ({ ...u, email: aEmail }));
            setMsg("Đã cập nhật tài khoản.");
            setAPassword("");
        } catch (ex) {
            setErr(ex?.message || "Cập nhật tài khoản thất bại");
        } finally {
            setSavingAccount(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Hồ sơ cá nhân</h1>
            </section>

            <section className="content">
                {/* Thông tin tài khoản */}
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Thông tin cơ bản</h3>
                    </div>
                    <div className="box-body">
                        <div className="row">
                            <div className="col-sm-6">
                                <p><b>Họ tên:</b> {auth?.user?.fullName ?? "—"}</p>
                                <p><b>Email:</b> {auth?.user?.email ?? "—"}</p>
                                <p>
                                    <b>Vai trò:</b>{" "}
                                    {roles.length ? roles.join(", ") : "—"}
                                </p>
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

                {/* Giáo viên cập nhật hồ sơ */}
                {isTeacher && (
                    <div className="box box-info">
                        <div className="box-header with-border">
                            <h3 className="box-title">Cập nhật thông tin giáo viên</h3>
                        </div>
                        <form className="box-body" onSubmit={onUpdateTeacher}>
                            {!myTeacherId && (
                                <div className="alert alert-warning">
                                    Tài khoản chưa gắn TeacherId — liên hệ Admin để liên kết.
                                </div>
                            )}

                            <div className="form-group">
                                <label>Họ tên</label>
                                <input
                                    className="form-control"
                                    value={tFullName}
                                    onChange={(e) => setTFullName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Số điện thoại</label>
                                <input
                                    className="form-control"
                                    value={tPhone}
                                    onChange={(e) => setTPhone(e.target.value)}
                                />
                            </div>

                            <button
                                className="btn btn-info"
                                disabled={savingTeacher || !myTeacherId}
                            >
                                {savingTeacher ? "Đang lưu..." : "Cập nhật hồ sơ giáo viên"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Admin/Teacher cập nhật tài khoản */}
                {(isAdmin || isTeacher) && (
                    <div className="box box-warning">
                        <div className="box-header with-border">
                            <h3 className="box-title">Cập nhật tài khoản</h3>
                        </div>
                        <form className="box-body" onSubmit={onUpdateAccount}>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    className="form-control"
                                    type="email"
                                    value={aEmail}
                                    onChange={(e) => setAEmail(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Mật khẩu mới (để trống nếu không đổi)</label>
                                <input
                                    className="form-control"
                                    type="password"
                                    value={aPassword}
                                    onChange={(e) => setAPassword(e.target.value)}
                                />
                            </div>
                            <button className="btn btn-warning" disabled={savingAccount}>
                                {savingAccount ? "Đang lưu..." : "Cập nhật tài khoản"}
                            </button>
                        </form>
                    </div>
                )}
            </section>
        </>
    );
}
