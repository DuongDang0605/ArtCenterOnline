import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { downloadImportClassTemplate, importClassStudentsExcel } from "./classStudents";
import { searchClasses } from "./classes";
import http from "../../api/http";
import ClassSearchInput from "./ClassSearchInput";

export default function ImportClassStudentsExcelPage() {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [fileName, setFileName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState([]);
    const [rows, setRows] = useState([]);
    const fileRef = useRef(null);

    useEffect(() => {
        if (!query.trim() || selectedClass) { setSuggestions([]); return; }
        let alive = true;
        searchClasses(query).then(res => { if (alive) setSuggestions(res); });
        return () => { alive = false; };
    }, [query, selectedClass]);

    async function onFileChanged(e) {
        const f = e.target.files?.[0];
        if (!f || !selectedClass) { alert("Chọn lớp trước."); return; }
        setFileName(f.name); setUploading(true); setErrors([]); setRows([]);
        try {
            const res = await importClassStudentsExcel(selectedClass.classId, f);
            if (res.errors) setErrors(res.errors); else if (res.pending) setRows(res.pending);
        } catch (ex) { setErrors([{ row: "-", error: ex?.userMessage || "Lỗi" }]); }
        finally { setUploading(false); }
    }

    const nav = useNavigate();

    async function onConfirm() {
        if (!selectedClass) {
            alert("Chưa chọn lớp.");
            return;
        }
        try {
            await http.post(
                `/ClassStudents/import-excel/${selectedClass.classId}/commit`,
                rows
            );

            // ✅ flash message chung chung
            nav(`/classes/${selectedClass.classId}/students`, {
                state: { flash: "Cập nhật danh sách lớp thành công." }
            });
        } catch (ex) {
            alert(ex?.response?.data?.message || "Lỗi khi lưu.");
        }
    }

    function onCancel() {
        setErrors([]); setRows([]); setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    }

    async function onDownloadTemplate() {
        if (!selectedClass) { alert("Chọn lớp trước."); return; }
        try {
            const res = await downloadImportClassTemplate(selectedClass.classId);
            const blob = new Blob([res.data], { type: res.headers["content-type"] });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `mau-import-hocvien-lop-${selectedClass.classId}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch { alert("Không tải được file mẫu."); }
    }

    return (
        <div className="content">
            <h3>NHẬP HỌC VIÊN VÀO LỚP TỪ EXCEL</h3>

            {/* Chọn lớp */}
            <div className="box box-info">
                <div className="box-header"><b>Chọn lớp</b></div>
                <div className="box-body">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <ClassSearchInput
                            value={selectedClass}
                            onChange={(cls) => {
                                setSelectedClass(cls);
                                setQuery(cls?.className || "");
                                setSuggestions([]);
                                setErrors([]);
                                setRows([]);
                                setFileName("");
                                if (fileRef.current) fileRef.current.value = "";
                            }}
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
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChanged} disabled={uploading} />
                    {fileName && <p>Đã chọn: <b>{fileName}</b></p>}
                    <button className="btn btn-link" onClick={onDownloadTemplate}>
                        <i className="fa fa-download" /> Tải file mẫu cho lớp này
                    </button>
                </div>
            </div>

            {/* Bảng lỗi */}
            {errors.length > 0 &&
                <div className="box box-danger">
                    <div className="box-header">Lỗi dữ liệu</div>
                    <div className="box-body table-responsive">
                        <table className="table table-bordered">
                            <thead><tr><th>Dòng</th><th>Lỗi</th></tr></thead>
                            <tbody>{errors.map((er, i) => <tr key={i}><td>{er.row}</td><td>{er.error}</td></tr>)}</tbody>
                        </table>
                        <button className="btn btn-default" onClick={onCancel}>Đóng</button>
                    </div>
                </div>}

            {/* Bảng chờ */}
            {rows.length > 0 &&
                <div className="box box-success">
                    <div className="box-header">Danh sách chờ</div>
                    <div className="box-body table-responsive">
                        <table className="table table-bordered">
                            <thead><tr><th>Dòng</th><th>Email</th><th>Tên học viên</th><th>Ghi chú</th></tr></thead>
                            <tbody>{rows.map((r, i) =>
                                <tr key={i}>
                                    <td>{r.row}</td><td>{r.email}</td><td>{r.studentName}</td>
                                    <td style={{ color: r.note === "Đã có trong lớp" ? "red" : (r.note.includes("Cập nhật") ? "green" : undefined) }}>{r.note}</td>
                                </tr>)}</tbody>
                        </table>
                        <button className="btn btn-success" onClick={onConfirm}><i className="fa fa-check" /> Xác nhận lưu</button>
                        <button className="btn btn-default" onClick={onCancel}>Hủy</button>
                    </div>
                </div>}
        </div>
    );
}
