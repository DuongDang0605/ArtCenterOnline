// src/Template/Profile/ProfilePage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../../auth/authCore";
import { getTeacher, updateTeacher } from "../Teacher/Teachers";
import { updateUser } from "../User/users";

export default function ProfilePage() {
    const auth = useAuth();
    const roles = auth?.roles ?? [];
    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");
    const isStudent = roles.includes("Student");

    // ===== Helpers =====
    const myUserId = useMemo(
        () => auth?.user?.userId ?? auth?.user?.UserId ?? null,
        [auth?.user]
    );
    const myTeacherId = useMemo(
        () => auth?.user?.teacherId ?? auth?.user?.TeacherId ?? null,
        [auth?.user]
    );

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    // ===== Teacher profile form =====
    // ----- Teacher form -----
    const [tFullName, setTFullName] = useState(
        auth?.user?.fullName ??
        auth?.user?.FullName ??
        auth?.user?.teacher?.fullName ??
        auth?.user?.teacher?.FullName ?? ""
    );

    const [tPhone, setTPhone] = useState(
        auth?.user?.phoneNumber ??
        auth?.user?.PhoneNumber ??
        auth?.user?.teacher?.phoneNumber ??
        auth?.user?.teacher?.PhoneNumber ?? ""
    );

    const [savingTeacher, setSavingTeacher] = useState(false);

    const onUpdateTeacher = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        if (!myTeacherId) {
            setErr("Không xác định được TeacherId.");
            return;
        }
        try {
            setSavingTeacher(true);
            await updateTeacher(myTeacherId, {
                TeacherName: tFullName,
                PhoneNumber: tPhone,
            });
            // đồng bộ lại auth user (nếu app có dùng)
            auth?.updateUser?.((u) => ({
                ...u,
                fullName: tFullName,
                phoneNumber: tPhone,
                FullName: tFullName,
                PhoneNumber: tPhone,
            }));
            setMsg("Đã cập nhật hồ sơ giáo viên.");
        } catch (ex) {
            const data = ex?.response?.data;
            const m = (typeof data === "string") ? data : (data?.message || data?.detail);
            setErr(m || ex?.message || "Cập nhật hồ sơ thất bại.");
        } finally {
            setSavingTeacher(false);
        }

    };
    useEffect(() => {
        const load = async () => {
            if (!isTeacher || !myTeacherId) return;
            try {
                const t = await getTeacher(myTeacherId);
                const name =
                    t?.teacherName ?? t?.TeacherName ?? t?.fullName ?? t?.FullName ?? "";
                const phone =
                    t?.phoneNumber ?? t?.PhoneNumber ?? "";
                if (!tFullName) setTFullName(name);
                if (!tPhone) setTPhone(phone);
                // eslint-disable-next-line no-unused-vars
            } catch (_e) {
                /* ignore */
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId]);
    // ===== Account (email + mật khẩu) =====
    const [aEmail, setAEmail] = useState(auth?.user?.email ?? auth?.user?.Email ?? "");
    const [aPassword, setAPassword] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);

    const onUpdateAccount = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        if (!myUserId) {
            setErr("Không xác định được UserId.");
            return;
        }
        try {
            setSavingAccount(true);
            await updateUser(myUserId, {
                Email: aEmail,
                Password: aPassword || undefined, // để trống nếu không đổi
            });
            // đồng bộ lại email trên client
            auth?.updateUser?.((u) => ({ ...u, email: aEmail, Email: aEmail }));
            setAPassword("");
            setMsg("Đã cập nhật tài khoản.");
        } catch (ex) {
            const data = ex?.response?.data;
            const m = (typeof data === "string") ? data : (data?.message || data?.detail);
            setErr(m || ex?.message || "Cập nhật tài khoản thất bại.");
        } finally {
            setSavingAccount(false);
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Thông tin cá nhân</h1>
            </section>

            <section className="content">

                {/* Thông báo chung */}
                {err && (
                    <div className="alert alert-danger">
                        {err}
                    </div>
                )}
                {msg && !err && (
                    <div className="alert alert-success">
                        {msg}
                    </div>
                )}

                {/* Box: Cập nhật thông tin giáo viên (chỉ Teacher) */}
                {isTeacher && (
                    <div className="box box-primary">
                        <div className="box-header with-border">
                            <h3 className="box-title">Cập nhật thông tin giáo viên</h3>
                        </div>
                        <form className="box-body" onSubmit={onUpdateTeacher}>
                            <div className="form-group">
                                <label>Họ tên</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={tFullName}
                                    onChange={(e) => setTFullName(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Số điện thoại</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={tPhone}
                                    onChange={(e) => setTPhone(e.target.value)}
                                />
                            </div>

                            <button className="btn btn-primary" disabled={savingTeacher}>
                                {savingTeacher ? "Đang lưu..." : "Cập nhật hồ sơ giáo viên"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Box: Cập nhật tài khoản (Email + Mật khẩu) — mở cho Admin/Teacher/Student */}
                {(isAdmin || isTeacher || isStudent) && (
                    <div className="box box-warning">
                        <div className="box-header with-border">
                            <h3 className="box-title">Cập nhật tài khoản</h3>
                        </div>
                        <form className="box-body" onSubmit={onUpdateAccount}>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={aEmail}
                                    onChange={(e) => setAEmail(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Mật khẩu mới (tùy chọn)</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={aPassword}
                                    onChange={(e) => setAPassword(e.target.value)}
                                    placeholder="Để trống nếu không đổi"
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
