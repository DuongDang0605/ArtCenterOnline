import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { downloadImportClassTemplate, importClassStudentsExcel } from "./classStudents";
import { searchClasses } from "./classes";
import ClassSearchInput from "./ClassSearchInput";
import http from "../../api/http";

import { useAuth } from "../../auth/authCore";
import ConfirmDialog from "../../component/ConfirmDialog";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";

export default function ImportClassStudentsExcelPage() {
    const nav = useNavigate();
    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const { showError, showSuccess, Toasts } = useToasts();

    // ====== State ======
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);

    const [fileName, setFileName] = useState("");
    const [uploading, setUploading] = useState(false);

    const [errors, setErrors] = useState([]); // [{row, error}]
    const [rows, setRows] = useState([]);     // pending rows từ BE

    const [confirmOpen, setConfirmOpen] = useState(false); // xác nhận commit
    const fileRef = useRef(null);

    // ====== Guard & đồng bộ quyền ======
    useEffect(() => {
        if (!isLoggedIn) {
            nav("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
            return;
        }
        if (!isAdmin) {
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, isAdmin]);

    // ====== Gợi ý lớp khi gõ (vẫn giữ nguyên UI) ======
    useEffect(() => {
        if (!query.trim() || selectedClass) { setSuggestions([]); return; }
        let alive = true;
        searchClasses(query)
            .then(res => { if (alive) setSuggestions(Array.isArray(res) ? res : []); })
            .catch(() => { /* im lặng */ });
        return () => { alive = false; };
    }, [query, selectedClass]);

    // ====== Chọn lớp từ autocomplete component ======
    function handleSelectClass(cls) {
        setSelectedClass(cls);
        setQuery(cls?.className || "");
        setSuggestions([]);
        setErrors([]);
        setRows([]);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    }

    // ====== Upload file Excel (nhận errors/pending) ======
    async function onFileChanged(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!selectedClass) {
            showError("Chọn lớp trước khi tải file.");
            // reset file input
            if (fileRef.current) fileRef.current.value = "";
            return;
        }
        if (!isAdmin) {
            showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            if (fileRef.current) fileRef.current.value = "";
            return;
        }

        setFileName(f.name);
        setUploading(true);
        setErrors([]);
        setRows([]);

        try {
            const res = await importClassStudentsExcel(selectedClass.classId, f);
            if (res?.errors) {
                // Lỗi: hiện bảng lỗi
                setErrors(res.errors);
                showError("File có lỗi. Vui lòng kiểm tra.");
            } else if (res?.pending) {
                setRows(res.pending);
                showSuccess(`Đã đọc ${res.pending.length} dòng. Kiểm tra trước khi lưu.`);
            } else {
                showError("Phản hồi không hợp lệ.");
            }
        } catch (ex) {
            setErrors([{ row: "-", error: extractErr(ex) }]);
            showError(extractErr(ex) || "Lỗi khi đọc file.");
        } finally {
            setUploading(false);
        }
    }

    // ====== Commit (xác nhận + gọi API) ======
    function askConfirmCommit() {
        if (!selectedClass) { showError("Chưa chọn lớp."); return; }
        if (rows.length === 0) { showError("Không có dữ liệu để lưu."); return; }
        if (!isAdmin) { showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
        setConfirmOpen(true);
    }

    async function doCommit() {
        if (!selectedClass || rows.length === 0) { setConfirmOpen(false); return; }
        try {
            await http.post(`/ClassStudents/import-excel/${selectedClass.classId}/commit`, rows);
            // Điều hướng tới trang học viên của lớp — gửi notice chung chung để trang đích show toast
            nav(`/classes/${selectedClass.classId}/students`, {
                state: { notice: "Cập nhật danh sách lớp thành công." },
                replace: true,
            });
        } catch (ex) {
            showError(extractErr(ex) || "Lỗi khi lưu.");
        } finally {
            setConfirmOpen(false);
        }
    }

    // ====== Cancel (xóa kết quả đọc) ======
    function onCancel() {
        setErrors([]);
        setRows([]);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    }

    // ====== Tải file mẫu ======
    async function onDownloadTemplate() {
        if (!selectedClass) { showError("Chọn lớp trước."); return; }
        if (!isAdmin) { showError("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
        try {
            const res = await downloadImportClassTemplate(selectedClass.classId);
            const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mau-import-hocvien-lop-${selectedClass.classId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showSuccess("Đã tải file mẫu.");
        } catch (ex) {
            showError(extractErr(ex) || "Không tải được file mẫu.");
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>NHẬP HỌC VIÊN VÀO LỚP TỪ EXCEL</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><a href="/classes">Lớp học</a></li>
                    <li className="active">Import Excel</li>
                </ol>
            </section>

            <section className="content">
                {/* Chọn lớp */}
                <div className="box box-info">
                    <div className="box-header"><b>Chọn lớp</b></div>
                    <div className="box-body">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <ClassSearchInput
                                value={selectedClass}
                                onChange={handleSelectClass}
                                disabled={!isAdmin}
                                title={isAdmin ? undefined : "Chỉ Admin được thao tác"}
                            />
                            {selectedClass && (
                                <span className="text-success">
                                    Đã chọn lớp: <b>{selectedClass.className}</b> {selectedClass.branch ? `(${selectedClass.branch})` : ""}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload */}
                <div className="box box-primary">
                    <div className="box-header"><b>Tải file Excel</b></div>
                    <div className="box-body">
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={onFileChanged}
                            disabled={uploading || !isAdmin}
                            title={isAdmin ? undefined : "Chỉ Admin được thao tác"}
                        />
                        {fileName && <p>Đã chọn: <b>{fileName}</b></p>}
                        <button
                            className={`btn btn-link ${isAdmin ? "" : "disabled"}`}
                            onClick={onDownloadTemplate}
                            disabled={!isAdmin}
                            title={isAdmin ? "Tải file mẫu cho lớp này" : "Chỉ Admin được thao tác"}
                        >
                            <i className="fa fa-download" /> Tải file mẫu cho lớp này
                        </button>
                    </div>
                </div>

                {/* Bảng lỗi */}
                {errors.length > 0 && (
                    <div className="box box-danger">
                        <div className="box-header"><b>Lỗi dữ liệu</b></div>
                        <div className="box-body table-responsive">
                            <table className="table table-bordered">
                                <thead><tr><th>Dòng</th><th>Lỗi</th></tr></thead>
                                <tbody>{errors.map((er, i) => (
                                    <tr key={i}><td>{er.row}</td><td style={{ whiteSpace: "pre-wrap" }}>{er.error}</td></tr>
                                ))}</tbody>
                            </table>
                            <button className="btn btn-default" onClick={onCancel}>Đóng</button>
                        </div>
                    </div>
                )}

                {/* Bảng chờ */}
                {rows.length > 0 && (
                    <div className="box box-success">
                        <div className="box-header"><b>Danh sách chờ</b></div>
                        <div className="box-body table-responsive">
                            <table className="table table-bordered">
                                <thead><tr><th>Dòng</th><th>Email</th><th>Tên học viên</th><th>Ghi chú</th></tr></thead>
                                <tbody>
                                    {rows.map((r, i) => {
                                        const note = String(r.note || "");
                                        const isInClass = note.includes("Đã có trong lớp");
                                        const isActivateNote = /Cập nhật|kích hoạt|isActive/i.test(note);
                                        const color = isInClass ? "red" : (isActivateNote ? "green" : undefined);
                                        return (
                                            <tr key={i}>
                                                <td>{r.row}</td>
                                                <td>{r.email}</td>
                                                <td>{r.studentName}</td>
                                                <td style={{ color }}>{note}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    className={`btn btn-success ${isAdmin ? "" : "disabled"}`}
                                    onClick={askConfirmCommit}
                                    disabled={!isAdmin || rows.length === 0}
                                    title={isAdmin ? "Xác nhận lưu vào lớp" : "Chỉ Admin được thao tác"}
                                >
                                    <i className="fa fa-check" /> Xác nhận lưu
                                </button>
                                <button className="btn btn-default" onClick={onCancel}>
                                    <i className="fa fa-undo" /> Làm lại
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Modal xác nhận commit — căn giữa, tiêu đề in đậm */}
            <ConfirmDialog
                open={confirmOpen}
                type="primary"
                title="Xác nhận nhập học viên"
                message={`Xác nhận lưu ${rows.length} dòng vào lớp "${selectedClass?.className || ""}"?`}
                details="Các học viên đã có trong lớp sẽ được bỏ qua hoặc kích hoạt lại theo ghi chú."
                confirmText="Lưu"
                cancelText="Hủy"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={doCommit}
            />

            {/* Toast lỗi/thành công dùng chung */}
            <Toasts />
        </>
    );
}
