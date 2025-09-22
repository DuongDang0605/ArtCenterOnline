// src/component/ConfirmDialog.jsx
import { useEffect, useRef } from "react";

export default function ConfirmDialog({
    open,
    title = "Xác nhận",
    message,
    details,
    type = "primary",
    confirmText = "Đồng ý",
    cancelText = "Hủy",
    onConfirm,
    onCancel,
    busy = false,
}) {
    const confirmBtnRef = useRef(null);

    useEffect(() => {
        if (open) {
            setTimeout(() => confirmBtnRef.current?.focus(), 50);
        }
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="modal fade in"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,.45)",
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1050,
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className="modal-dialog" style={{ maxWidth: 480, margin: 0 }}>
                <div className="modal-content" style={{ borderRadius: 6 }}>
                    <div className="modal-header">
                        <button type="button" className="close" onClick={onCancel} disabled={busy}>
                            <span aria-hidden="true">&times;</span>
                        </button>
                        <h4 className="modal-title" style={{ fontWeight: 600 }}>
                            {title}
                        </h4>
                    </div>

                    <div className="modal-body">
                        {typeof message === "string" ? <p style={{ margin: 0 }}>{message}</p> : message}
                        {details && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                                {typeof details === "string" ? <p style={{ margin: 0 }}>{details}</p> : details}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-default" onClick={onCancel} disabled={busy}>
                            {cancelText}
                        </button>
                        <button
                            ref={confirmBtnRef}
                            className={`btn btn-${type}`}
                            onClick={onConfirm}
                            disabled={busy}
                        >
                            {busy ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-check" />}{" "}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
