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

    const myUserId = useMemo(
        () => auth?.user?.userId ?? auth?.user?.UserId ?? null,
        [auth?.user]
    );
    const myTeacherId = useMemo(
        () => auth?.user?.teacherId ?? auth?.user?.TeacherId ?? null,
        [auth?.user]
    );

    const [err, setErr] = useState("");
    const [notice, setNotice] = useState("");

    // ===== Teacher profile =====
    const [tFullName, setTFullName] = useState(
        auth?.user?.fullName ??
        auth?.user?.FullName ??
        auth?.user?.teacher?.fullName ??
        auth?.user?.teacher?.FullName ??
        ""
    );
    const [tPhone, setTPhone] = useState(
        auth?.user?.phoneNumber ??
        auth?.user?.PhoneNumber ??
        auth?.user?.teacher?.phoneNumber ??
        auth?.user?.teacher?.PhoneNumber ??
        ""
    );
    const [savingTeacher, setSavingTeacher] = useState(false);

    const onUpdateTeacher = async (e) => {
        e.preventDefault();
        setErr(""); setNotice("");
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
            auth?.updateUser?.((u) => ({
                ...u,
                fullName: tFullName,
                phoneNumber: tPhone,
                FullName: tFullName,
                PhoneNumber: tPhone,
            }));
            setNotice("Đã cập nhật hồ sơ giáo viên.");
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
                const name = t?.teacherName ?? t?.TeacherName ?? t?.fullName ?? t?.FullName ?? "";
                const phone = t?.phoneNumber ?? t?.PhoneNumber ?? "";
                if (!tFullName) setTFullName(name);
                if (!tPhone) setTPhone(phone);
            } catch { /* ignore */ }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId]);

    // ===== Account (email readonly + đổi mật khẩu realtime validation) =====
    const [aEmail] = useState(auth?.user?.email ?? auth?.user?.Email ?? "");
    const [aPassword, setAPassword] = useState("");
    const [aPassword2, setAPassword2] = useState("");
    const [pwTouched, setPwTouched] = useState(false);
    const [pw2Touched, setPw2Touched] = useState(false);
    const [savingAccount, setSavingAccount] = useState(false);

    const trimmedPw = (aPassword || "").trim();
    const trimmedPw2 = (aPassword2 || "").trim();
    const pwTooShort = !!trimmedPw && trimmedPw.length < 6;
    const pwMismatch = (!!trimmedPw || !!trimmedPw2) && trimmedPw !== trimmedPw2;
    const pwMatchOk = !!trimmedPw && !!trimmedPw2 && trimmedPw === trimmedPw2 && !pwTooShort;
    const accountInvalid = pwTooShort || pwMismatch;

    const onUpdateAccount = async (e) => {
        e.preventDefault();
        setErr(""); setNotice("");
        if (!myUserId) {
            setErr("Không xác định được UserId.");
            return;
        }
        if (accountInvalid) {
            setErr("Vui lòng sửa lỗi ở phần mật khẩu trước khi lưu.");
            return;
        }
        try {
            setSavingAccount(true);
            const payload = {};
            if (trimmedPw) payload.Password = trimmedPw;
            await updateUser(myUserId, payload);

            setAPassword("");
            setAPassword2("");
            setPwTouched(false);
            setPw2Touched(false);

            setNotice(trimmedPw ? "Đã cập nhật mật khẩu." : "Không có thay đổi để lưu.");
        } catch (ex) {
            const data = ex?.response?.data;
            const m = (typeof data === "string") ? data : (data?.message || data?.detail);
            setErr(m || ex?.message || "Cập nhật tài khoản thất bại.");
        } finally {
            setSavingAccount(false);
        }
    };

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    const fgClass = (error, success) => {
        if (error) return "form-group has-error";
        if (success) return "form-group has-success";
        return "form-group";
    };

    return (
        <>
            {/* Toast thành công */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 16,
                        zIndex: 9999,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                    }}
                >
                    <button
                        type="button"
                        className="close"
                        onClick={() => setNotice("")}
                        aria-label="Close"
                        style={{ marginLeft: 8 }}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            <section className="content-header">
                <h1>Thông tin cá nhân</h1>
            </section>

            <section className="content">
                {err && <div className="alert alert-danger">{err}</div>}

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

                {(isAdmin || isTeacher || isStudent) && (
                    <div className="box box-warning">
                        <div className="box-header with-border">
                            <h3 className="box-title">Cập nhật tài khoản</h3>
                        </div>
                        <form className="box-body" onSubmit={onUpdateAccount}>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" className="form-control" value={aEmail} disabled />
                                <p className="help-block">Email không thể thay đổi.</p>
                            </div>

                            <div className={fgClass(pwTouched && pwTooShort, false)}>
                                <label>Mật khẩu mới (tùy chọn)</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={aPassword}
                                    onChange={(e) => setAPassword(e.target.value)}
                                    onBlur={() => setPwTouched(true)}
                                    placeholder="Để trống nếu không đổi"
                                />
                                {pwTouched && pwTooShort && (
                                    <p className="help-block">Mật khẩu mới phải có ít nhất 6 ký tự.</p>
                                )}
                            </div>

                            <div className={fgClass(pw2Touched && pwMismatch, pw2Touched && pwMatchOk)}>
                                <label>Xác nhận mật khẩu mới</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={aPassword2}
                                    onChange={(e) => setAPassword2(e.target.value)}
                                    onBlur={() => setPw2Touched(true)}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                                {pw2Touched && pwMismatch && (
                                    <p className="help-block">Xác nhận mật khẩu không khớp.</p>
                                )}
                                {pw2Touched && pwMatchOk && (
                                    <p className="help-block text-green">Mật khẩu khớp.</p>
                                )}
                            </div>

                            <button
                                className="btn btn-warning"
                                disabled={savingAccount || accountInvalid}
                            >
                                {savingAccount ? "Đang lưu..." : "Cập nhật tài khoản"}
                            </button>
                        </form>
                    </div>
                )}
            </section>
        </>
    );
}
