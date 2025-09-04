// src/component/OverlapWarningModal.jsx
import React from "react";

/**
 * Modal cảnh báo trùng học sinh (list chuỗi).
 * props:
 *  - open: boolean
 *  - title?: string
 *  - warnings: string[]
 *  - onCancel: () => void
 *  - onConfirm: () => void
 */
export default function OverlapWarningModal({
    open,
    title = "Cảnh báo trùng học sinh",
    warnings = [],
    onCancel,
    onConfirm,
}) {
    if (!open) return null;

    return (
        <div className="modal fade in" style={{ display: "block", background: "rgba(0,0,0,.4)" }}>
            <div className="modal-dialog" style={{ maxWidth: 720 }}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button type="button" className="close" aria-label="Close" onClick={onCancel}>
                            <span aria-hidden="true">×</span>
                        </button>
                        <h4 className="modal-title">
                            <i className="fa fa-exclamation-triangle text-yellow" style={{ marginRight: 8 }} />
                            {title}
                        </h4>
                    </div>

                    <div className="modal-body" style={{ maxHeight: 420, overflow: "auto" }}>
                        <p className="text-muted" style={{ marginBottom: 10 }}>
                            Các học sinh dưới đây đang bị <b>trùng khung giờ</b> với lớp khác:
                        </p>
                        {warnings.length === 0 ? (
                            <div className="callout callout-success" style={{ marginBottom: 0 }}>
                                Không có trùng lịch.
                            </div>
                        ) : (
                            <ul className="list-unstyled" style={{ margin: 0 }}>
                                {warnings.map((w, i) => (
                                    <li key={i} style={{ marginBottom: 6 }}>
                                        <i className="fa fa-user" style={{ width: 18 }} /> {w}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-default" onClick={onCancel}>
                            Hủy
                        </button>
                        <button
                            className="btn btn-warning"
                            onClick={onConfirm}
                            disabled={warnings.length === 0}
                            title={warnings.length === 0 ? "Không có trùng lịch" : "Vẫn tiếp tục lưu"}
                        >
                            <i className="fa fa-check" /> Tiếp tục lưu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
