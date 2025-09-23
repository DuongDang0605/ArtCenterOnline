// src/hooks/useToasts.js
import { useEffect, useState, useCallback } from "react";

const ERR_MS = 5000;   // error: 5s + progress
const OK_MS = 4000;   // success: 4s

export function useToasts() {
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [remain, setRemain] = useState(0); // error progress

    const showError = useCallback((msg) => {
        const t = String(msg || "");
        setError(t);
        if (t) setRemain(ERR_MS);
    }, []);

    const showSuccess = useCallback((msg) => {
        setNotice(String(msg || ""));
    }, []);

    // auto-hide error + progress
    useEffect(() => {
        if (!error) return;
        const started = Date.now();
        const iv = setInterval(() => {
            const left = Math.max(0, ERR_MS - (Date.now() - started));
            setRemain(left);
            if (left === 0) setError("");
        }, 100);
        return () => clearInterval(iv);
    }, [error]);

    // auto-hide success
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), OK_MS);
        return () => clearTimeout(t);
    }, [notice]);

    const Toasts = useCallback(() => (
        <>
            {/* Success */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{ position: "fixed", top: 70, right: 16, zIndex: 9999, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            {/* Error + progress */}
            {error && (
                <div
                    className="alert alert-danger"
                    style={{ position: "fixed", top: notice ? 120 : 70, right: 16, zIndex: 10000, maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                >
                    <button type="button" className="close" onClick={() => setError("")}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {error}
                    <div style={{ fontSize: 11, opacity: .7, marginTop: 4 }}>
                        Tự ẩn sau {(remain / 1000).toFixed(1)}s
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(remain / ERR_MS) * 100}%`,
                                background: "#a94442",
                                transition: "width 100ms linear",
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    ), [notice, error, remain]);

    return { showError, showSuccess, setNotice, setError, Toasts };
}
