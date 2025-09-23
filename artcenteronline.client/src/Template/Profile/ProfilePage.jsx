// src/Template/Profile/ProfilePage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authCore";
import { getTeacher, updateTeacher } from "../Teacher/Teachers";
import { updateUser } from "../User/users";
import { useToasts } from "../../hooks/useToasts";
import extractErr from "../../utils/extractErr";
import ConfirmDialog from "../../component/ConfirmDialog";

export default function ProfilePage() {
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isLoggedIn = !!auth?.user || !!auth?.token;
    const isTeacher = roles.includes("Teacher");

    const navigate = useNavigate();
    const { showError, showSuccess, Toasts } = useToasts();

    // Guard: chưa đăng nhập -> login (đồng bộ cách làm ở ClassesPage)
    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
        }
    }, [isLoggedIn, navigate]);

    const myUserId = useMemo(
        () => auth?.user?.userId ?? auth?.user?.UserId ?? null,
        [auth?.user]
    );
    const myTeacherId = useMemo(
        () => auth?.user?.teacherId ?? auth?.user?.TeacherId ?? null,
        [auth?.user]
    );

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
    const [confirmTeacherOpen, setConfirmTeacherOpen] = useState(false);

    // Tải thông tin GV lần đầu (nếu có TeacherId)
    useEffect(() => {
        const load = async () => {
            if (!isTeacher || !myTeacherId) return;
            try {
                const t = await getTeacher(myTeacherId);
                const name = t?.teacherName ?? t?.TeacherName ?? t?.fullName ?? t?.FullName ?? "";
                const phone = t?.phoneNumber ?? t?.PhoneNumber ?? "";
                if (!tFullName) setTFullName(name);
                if (!tPhone) setTPhone(phone);
            } catch (e) {
                // Không làm ồn, chỉ báo lỗi nếu người dùng thao tác lưu
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher, myTeacherId]);

    function submitTeacher(e) {
        e.preventDefault();
        if (!myTeacherId) {
            showError("Không xác định được TeacherId.");
            return;
        }
        setConfirmTeacherOpen(true); // xác nhận trước khi lưu
    }

    async function doUpdateTeacher() {
        setConfirmTeacherOpen(false);
        if (!myTeacherId) return;
        try {
            setSavingTeacher(true);
            await updateTeacher(myTeacherId, {
                TeacherName: (tFullName || "").trim(),
                PhoneNumber: (tPhone || "").trim(),
            });

            // Cập nhật auth local cho đồng bộ UI
            auth?.updateUser?.((u) => ({
                ...u,
                fullName: tFullName,
                phoneNumber: tPhone,
                FullName: tFullName,
                PhoneNumber: tPhone,
            }));

            showSuccess("Đã cập nhật hồ sơ giáo viên.");
        } catch (ex) {
            showError(extractErr(ex));
        } finally {
            setSavingTeacher(false);
        }
    }

    // ===== Account (đổi mật khẩu với kiểm tra realtime) =====
    const [aEmail] = useState(auth?.user?.email ?? auth?.user?.Email ?? "");
    const [aPassword, setAPassword] = useState("");
    const [aPassword2, setAPassword2] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);
    const [confirmAccountOpen, setConfirmAccountOpen] = useState(false);

    const trimmedPw = (aPassword || "").trim();
    const trimmedPw2 = (aPassword2 || "").trim();
    const pwTooShort = !!trimmedPw && trimmedPw.length < 6;
    const pwMismatch = (!!trimmedPw || !!trimmedPw2) && trimmedPw !== trimmedPw2;
    const accountInvalid = pwTooShort || pwMismatch;

    function submitAccount(e) {
        e.preventDefault();
        if (!myUserId) {
            showError("Không xác định được UserId.");
            return;
        }
        if (accountInvalid) {
            showError("Vui lòng sửa lỗi ở phần mật khẩu trước khi lưu.");
            return;
        }
        // Nếu không nhập mật khẩu mới, báo “không có thay đổi”
        if (!trimmedPw) {
            showSuccess("Không có thay đổi để lưu.");
            return;
        }
        setConfirmAccountOpen(true);
    }

    async function doUpdateAccount() {
        setConfirmAccountOpen(false);
        if (!myUserId) return;
        try {
            setSavingAccount(true);
            const payload = {};
            if (trimmedPw) payload.Password = trimmedPw;
            await updateUser(myUserId, payload);

            // Reset form
            setAPassword("");
            setAPassword2("");

            showSuccess("Đã cập nhật mật khẩu.");
        } catch (ex) {
            showError(extractErr(ex));
        } finally {
            setSavingAccount(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Hồ sơ của tôi</h1>
                <ol className="breadcrumb">
                    <li><a href="/"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li className="active">Hồ sơ</li>
                </ol>
            </section>

            <section className="content">
                {/* Hồ sơ Giáo viên (chỉ hiện nếu có TeacherId) */}
                {myTeacherId?  (
                    <div className="box box-primary">
                        <div className="box-header with-border">
                            <h3 className="box-title">Thông tin giáo viên</h3>
                        </div>
                        <form onSubmit={submitTeacher}>
                            <div className="box-body">
                                <div className="form-group">
                                    <label>Họ và tên</label>
                                    <input
                                        className="form-control"
                                        value={tFullName}
                                        onChange={(e) => setTFullName(e.target.value)}
                                        placeholder="Nhập họ và tên"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Số điện thoại</label>
                                    <input
                                        className="form-control"
                                        value={tPhone}
                                        onChange={(e) => setTPhone(e.target.value)}
                                        placeholder="Nhập số điện thoại"
                                    />
                                </div>
                            </div>
                            <div className="box-footer">
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={savingTeacher}
                                    title="Lưu hồ sơ giáo viên"
                                >
                                    {savingTeacher ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-check" />}{" "}
                                    Lưu hồ sơ
                                </button>
                            </div>
                        </form>
                    </div>
                ): null}

                {/* Tài khoản (Email + đổi mật khẩu) */}
                <div className="box box-info">
                    <div className="box-header with-border">
                        <h3 className="box-title">Tài khoản</h3>
                    </div>
                    <form onSubmit={submitAccount}>
                        <div className="box-body">
                            <div className="form-group">
                                <label>Email</label>
                                <input className="form-control" value={aEmail} disabled readOnly />
                            </div>

                            <div className={`form-group ${pwTooShort ? "has-error" : ""}`}>
                                <label>Mật khẩu mới</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={aPassword}
                                    onChange={(e) => setAPassword(e.target.value)}
                                    placeholder="Ít nhất 6 ký tự"
                                />
                                {pwTooShort && <span className="help-block">Mật khẩu tối thiểu 6 ký tự.</span>}
                            </div>

                            <div className={`form-group ${pwMismatch ? "has-error" : ""}`}>
                                <label>Nhập lại mật khẩu mới</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={aPassword2}
                                    onChange={(e) => setAPassword2(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                                {pwMismatch && <span className="help-block">Mật khẩu nhập lại không khớp.</span>}
                            </div>
                        </div>

                        <div className="box-footer">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={savingAccount}
                                title="Lưu thay đổi tài khoản"
                            >
                                {savingAccount ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-check" />}{" "}
                                Cập nhật tài khoản
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* Xác nhận lưu hồ sơ giáo viên */}
            <ConfirmDialog
                open={confirmTeacherOpen}
                type="primary"
                title="Xác nhận"
                message="Lưu thay đổi cho hồ sơ giáo viên?"
                confirmText="Lưu"
                cancelText="Hủy"
                onCancel={() => setConfirmTeacherOpen(false)}
                onConfirm={doUpdateTeacher}
                busy={savingTeacher}
            />

            {/* Xác nhận đổi mật khẩu */}
            <ConfirmDialog
                open={confirmAccountOpen}
                type="primary"
                title="Xác nhận"
                message="Cập nhật mật khẩu cho tài khoản của bạn?"
                confirmText="Cập nhật"
                cancelText="Hủy"
                onCancel={() => setConfirmAccountOpen(false)}
                onConfirm={doUpdateAccount}
                busy={savingAccount}
            />

            {/* Toasts dùng chung (thành công/lỗi) */}
            <Toasts />
        </>
    );
}
