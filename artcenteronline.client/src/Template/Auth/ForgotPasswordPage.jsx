// src/Template/Auth/ForgotPasswordPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { requestOtp, verifyOtp, resetPassword } from "../../api/auth";
import { useNavigate } from "react-router-dom";
import "./login.adminlte2.css"; // dùng chung CSS với LoginPage

const OTP_TTL_SECONDS = 600;
const RESEND_COOLDOWN = 60;

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [resetToken, setResetToken] = useState(sessionStorage.getItem("resetToken") || "");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");

    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [reseting, setReseting] = useState(false);

    const [msg, setMsg] = useState({ type: "", text: "" });

    const [cooldown, setCooldown] = useState(0);
    const [ttl, setTtl] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    useEffect(() => {
        if (ttl <= 0) return;
        const t = setInterval(() => setTtl((s) => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, [ttl]);

    const ttlText = useMemo(() => {
        const m = Math.floor(ttl / 60);
        const s = ttl % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    }, [ttl]);

    const onSendOtp = async (e) => {
        e?.preventDefault();
        setMsg({ type: "", text: "" });

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setMsg({ type: "danger", text: "Vui lòng nhập email hợp lệ." });
            return;
        }

        try {
            setSending(true);
            const res = await requestOtp(email.trim());
            setMsg({ type: "success", text: res?.message || "Nếu email tồn tại, mã OTP đã được gửi." });
            setStep(2);
            setTtl(OTP_TTL_SECONDS);
            setCooldown(RESEND_COOLDOWN);
        } catch (err) {
            const data = err?.response?.data;
            if (err?.response?.status === 429) {
                const retry = data?.retryAfterSeconds ?? 60;
                setCooldown(retry);
                setStep(2);
                if (ttl <= 0) setTtl(OTP_TTL_SECONDS);
                setMsg({ type: "warning", text: "Bạn yêu cầu quá nhanh. Vui lòng thử lại sau " + retry + " giây." });
            } else {
                setMsg({ type: "danger", text: data?.message || "Không gửi được OTP. Thử lại sau." });
            }
        } finally {
            setSending(false);
        }
    };

    const onVerify = async (e) => {
        e?.preventDefault();
        setMsg({ type: "", text: "" });

        const clean = (code ?? "").toString().replace(/\s+/g, "").replace(/\D/g, "");
        if (!/^\d{6}$/.test(clean)) {
            setMsg({ type: "danger", text: "Mã OTP phải gồm đúng 6 chữ số." });
            return;
        }

        try {
            setVerifying(true);
            const res = await verifyOtp(email.trim(), clean);
            const token = res?.resetToken ?? res?.data?.resetToken ?? "";
            if (!token) {
                setMsg({ type: "danger", text: "Không nhận được mã đặt lại (reset token). Thử lại." });
                return;
            }
            setResetToken(token);
            sessionStorage.setItem("resetToken", token);
            setMsg({ type: "success", text: "Xác minh OTP thành công. Vui lòng đặt mật khẩu mới." });
            setStep(3);
        } catch (err) {
            const data = err?.response?.data;
            setMsg({
                type: "danger",
                text: data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
            });
        } finally {
            setVerifying(false);
        }
    };

    const onReset = async (e) => {
        e?.preventDefault();
        setMsg({ type: "", text: "" });

        const token = resetToken || sessionStorage.getItem("resetToken") || "";
        if (!token) {
            setMsg({ type: "danger", text: "Thiếu mã đặt lại. Vui lòng xác minh OTP lại." });
            return;
        }
        if (!newPwd || newPwd.trim().length < 6) {
            setMsg({ type: "danger", text: "Mật khẩu mới phải từ 6 ký tự." });
            return;
        }
        if (newPwd !== confirmPwd) {
            setMsg({ type: "danger", text: "Xác nhận mật khẩu không khớp." });
            return;
        }

        try {
            setReseting(true);
            const res = await resetPassword(token, newPwd);
            sessionStorage.removeItem("resetToken");
            // Điều hướng về Login + flash success
            navigate("/login", {
                replace: true,
                state: { alert: { type: "success", text: res?.message || "Đổi mật khẩu thành công. Vui lòng đăng nhập." } },
            });
        } catch (err) {
            const data = err?.response?.data;
            setMsg({ type: "danger", text: data?.message || "Không thể đổi mật khẩu. Thử lại." });
        } finally {
            setReseting(false);
        }
    };

    const onResend = async () => {
        if (cooldown > 0) return;
        await onSendOtp();
    };

    return (
        <div className="hold-transition login-page aco-login-bg">
            <div className="login-box aco-login-box">
                <div className="login-logo aco-login-logo">
                    <a href="#" onClick={(e) => e.preventDefault()}>
                        <span className="aco-brand-icon"><i className="fa fa-paint-brush" /></span>
                        <span className="aco-brand-text"><b>ArtCenter</b>Online</span>
                    </a>
                </div>

                <div className="login-box-body aco-card">
                    <p className="login-box-msg aco-subtitle">
                        {step === 1 && "Bước 1/3 — Nhập email để nhận mã OTP"}
                        {step === 2 && `Bước 2/3 — Nhập mã OTP (còn ${ttlText})`}
                        {step === 3 && "Bước 3/3 — Đặt mật khẩu mới"}
                    </p>

                    {msg.text && (
                        <div className={`alert alert-${msg.type || "info"} aco-alert`} role="alert">
                            <i className={`fa ${msg.type === "success" ? "fa-check-circle" : msg.type === "warning" ? "fa-exclamation-circle" : "fa-exclamation-triangle"} aco-alert-icon`} />
                            {msg.text}
                        </div>
                    )}

                    {/* STEP 1 */}
                    {step === 1 && (
                        <form onSubmit={onSendOtp} className="aco-form" autoComplete="off" noValidate>
                            <div className="form-group has-feedback aco-field">
                                <input
                                    type="email"
                                    className="form-control aco-input"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <span className="glyphicon glyphicon-envelope form-control-feedback aco-feedback" />
                            </div>
                            <button type="submit" className="btn btn-primary btn-block btn-flat aco-btn" disabled={sending}>
                                {sending ? <><i className="fa fa-spinner fa-spin aco-btn-icon" />Đang gửi…</> : <><i className="fa fa-paper-plane aco-btn-icon" />Gửi mã OTP</>}
                            </button>
                            <p className="aco-links">
                                <a className="aco-link" href="/login"><i className="fa fa-sign-in aco-btn-icon" /> Quay lại đăng nhập</a>
                            </p>
                        </form>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <form onSubmit={onVerify} className="aco-form" autoComplete="off" noValidate>
                            <div className="form-group aco-field">
                                <label className="aco-label">Email</label>
                                <input type="email" className="form-control aco-input" value={email} disabled />
                            </div>

                            <div className="form-group has-feedback aco-field">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    className="form-control aco-input"
                                    placeholder="Mã OTP (6 số)"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    required
                                />
                                <span className="glyphicon glyphicon-lock form-control-feedback aco-feedback" />
                            </div>

                            <button type="submit" className="btn btn-success btn-block btn-flat aco-btn" disabled={verifying || ttl <= 0}>
                                {ttl > 0 ? (verifying ? <><i className="fa fa-spinner fa-spin aco-btn-icon" />Đang xác minh…</> : <><i className="fa fa-check aco-btn-icon" />Xác minh OTP</>) : "OTP đã hết hạn"}
                            </button>

                            <div className="row aco-row">
                                <div className="col-xs-6">
                                    <button type="button" className="btn btn-default btn-block aco-btn" onClick={() => setStep(1)}>
                                        <i className="fa fa-envelope aco-btn-icon" /> Nhập email khác
                                    </button>
                                </div>
                                <div className="col-xs-6">
                                    <button
                                        type="button"
                                        className="btn btn-warning btn-block aco-btn"
                                        onClick={onResend}
                                        disabled={cooldown > 0}
                                        title={cooldown > 0 ? `Chờ ${cooldown}s` : "Gửi lại mã"}
                                    >
                                        {cooldown > 0 ? `Gửi lại (${cooldown}s)` : <><i className="fa fa-refresh aco-btn-icon" />Gửi lại mã</>}
                                    </button>
                                </div>
                            </div>

                            <p className="aco-links">
                                <a className="aco-link" href="/login"><i className="fa fa-sign-in aco-btn-icon" /> Quay lại đăng nhập</a>
                            </p>
                        </form>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <form onSubmit={onReset} className="aco-form" autoComplete="off" noValidate>
                            <div className="form-group aco-field">
                                <label className="aco-label">Email</label>
                                <input type="email" className="form-control aco-input" value={email} disabled />
                            </div>

                            <div className="form-group has-feedback aco-field">
                                <input
                                    type="password"
                                    className="form-control aco-input"
                                    placeholder="Mật khẩu mới (≥ 6 ký tự)"
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <span className="glyphicon glyphicon-lock form-control-feedback aco-feedback" />
                            </div>

                            <div className="form-group has-feedback aco-field">
                                <input
                                    type="password"
                                    className="form-control aco-input"
                                    placeholder="Xác nhận mật khẩu mới"
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    required
                                />
                                <span className="glyphicon glyphicon-log-in form-control-feedback aco-feedback" />
                            </div>

                            <button type="submit" className="btn btn-primary btn-block btn-flat aco-btn" disabled={reseting || !resetToken}>
                                {reseting ? <><i className="fa fa-spinner fa-spin aco-btn-icon" />Đang đổi mật khẩu…</> : <><i className="fa fa-save aco-btn-icon" />Đổi mật khẩu</>}
                            </button>

                            <p className="aco-links">
                                <a className="aco-link" href="/login"><i className="fa fa-sign-in aco-btn-icon" /> Về trang đăng nhập</a>
                            </p>
                        </form>
                    )}

                    <p className="aco-footnote">© {new Date().getFullYear()} ArtCenterOnline</p>
                </div>
            </div>
        </div>
    );
}
