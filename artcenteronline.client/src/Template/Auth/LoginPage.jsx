// src/Template/Auth/LoginPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../../api/auth";
import { useAuth } from "../../auth/authCore";
import "./login.adminlte2.css"; // <-- THÊM DÒNG NÀY

export default function LoginPage() {
    const nav = useNavigate();
    const loc = useLocation();
    const { loginOk } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try {
            const data = await login(email.trim(), password);
            loginOk(data);

            let to = loc.state?.from;
            if (!to) {
                if (data.user?.roles?.includes("Admin")) to = "/";
                else if (data.user?.roles?.includes("Teacher")) to = "/";
                else to = "/";
            }
            nav(to, { replace: true });
        } catch (ex) {
            const msg =
                ex?.response?.data?.message ||
                ex?.response?.data ||
                ex?.message ||
                "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
            setErr(typeof msg === "string" ? msg : "Đăng nhập lỗi");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="hold-transition login-page aco-login-bg">
            <div className="login-box aco-login-box">
                <div className="login-logo aco-login-logo">
                    <a href="#" onClick={(e) => e.preventDefault()}>
                        <span className="aco-brand-icon">
                            <i className="fa fa-paint-brush" />
                        </span>
                        <span className="aco-brand-text"><b>ArtCenter</b>Online</span>
                    </a>
                </div>

                <div className="login-box-body aco-card">
                    <p className="login-box-msg aco-subtitle">Đăng nhập để bắt đầu phiên làm việc</p>

                    {err && (
                        <div className="alert alert-danger aco-alert" role="alert">
                            <i className="fa fa-exclamation-triangle aco-alert-icon" />
                            {err}
                        </div>
                    )}

                    <form onSubmit={onSubmit} autoComplete="off" noValidate className="aco-form">
                        <div className="form-group has-feedback aco-field">
                            <input
                                type="email"
                                className="form-control aco-input"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                            <span className="glyphicon glyphicon-envelope form-control-feedback aco-feedback" />
                        </div>

                        <div className="form-group has-feedback aco-field">
                            <input
                                type="password"
                                className="form-control aco-input"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <span className="glyphicon glyphicon-lock form-control-feedback aco-feedback" />
                        </div>

                        <div className="row aco-row">
                            <div className="col-xs-7 aco-remember">
                                <label className="aco-checkbox">
                                    <input type="checkbox" /> <span>Ghi nhớ</span>
                                </label>
                            </div>
                            <div className="col-xs-5">
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block btn-flat aco-btn"
                                    disabled={busy}
                                >
                                    {busy ? (
                                        <>
                                            <i className="fa fa-spinner fa-spin aco-btn-icon" />
                                            Đang vào...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa fa-sign-in aco-btn-icon" />
                                            Đăng nhập
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>

                    <p className="aco-footnote">© {new Date().getFullYear()} ArtCenterOnline</p>
                </div>
            </div>
        </div>
    );
}
