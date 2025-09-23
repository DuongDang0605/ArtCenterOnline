// src/Template/Class/BulkWithdrawPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveStudentsForWithdraw, bulkWithdraw } from "./classes";
import ClassSearchInput from "./ClassSearchInput";
import ConfirmDialog from "../../component/ConfirmDialog";
import { useToasts } from "../../hooks/useToasts";
import extractErr from "../../utils/extractErr";

export default function BulkWithdrawPage() {
    const [selectedClass, setSelectedClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [totalInClass, setTotalInClass] = useState(0);
    const [checked, setChecked] = useState({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const { showError, Toasts } = useToasts();
    const navigate = useNavigate();

    // Chọn lớp -> tải danh sách học sinh
    const handleSelectClass = async (cls) => {
        setSelectedClass(cls || null);
        setStudents([]);
        setChecked({});
        setTotalInClass(0);

        const classId = cls?.classId ?? cls?.ClassID;
        if (!classId) return;

        try {
            setLoading(true);
            const res = await getActiveStudentsForWithdraw(classId, {
                page: 1,
                pageSize: 50,
            });
            const data = res?.data ?? {};
            const items = Array.isArray(data.items) ? data.items : [];

            setStudents(items);
            setTotalInClass(Number(data.totalActiveInClass ?? 0));

            // Quy tắc mới:
            // - selectable === true  -> auto-tick (true)
            // - selectable !== true  -> không cho tích (UI sẽ disable)
            const init = {};
            items.forEach((s) => {
                const id = s.studentId ?? s.StudentId;
                const selectable = (s.selectable ?? s.Selectable) === true;
                if (id != null) init[id] = selectable;
            });
            setChecked(init);
        } catch (e) {
            showError(extractErr(e) || "Không tải được danh sách học sinh.");
        } finally {
            setLoading(false);
        }
    };

    // Toggle checkbox (chỉ gọi được nếu không disabled)
    const handleToggle = (id) => {
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Tính số học sinh chỉ còn đúng 1 lớp (lớp hiện tại)
    const countChecked = students.filter(
        (s) => (s.activeClassCount ?? s.ActiveClassCount ?? 0) <= 1
    ).length;

    function askConfirm() {
        if (!selectedClass) {
            showError("Vui lòng chọn lớp trước.");
            return;
        }
        if (countChecked === 0) {
            showError("Vui lòng chọn ít nhất 1 học sinh (những học sinh không còn ở lớp khác).");
            return;
        }
        setConfirmOpen(true);
    }

    const handleSubmit = async () => {
        const ids = Object.keys(checked)
            .filter((id) => checked[id])
            .map((id) => parseInt(id, 10))
            .filter((x) => !Number.isNaN(x));

        const classId = selectedClass?.classId ?? selectedClass?.ClassID;
        if (!classId || ids.length === 0) return;

        try {
            setLoading(true);
            const res = await bulkWithdraw(classId, ids);

            const succeeded = res?.data?.summary?.succeeded ?? 0;
            const failed = res?.data?.summary?.failed ?? 0;

            navigate(`/classes/${classId}/students`, {
                replace: true,
                state: {
                    notice:
                        failed === 0
                            ? "Đã cập nhật danh sách lớp thành công."
                            : `Đã cập nhật: ${succeeded} thành công, ${failed} lỗi.`,
                },
            });
        } catch (e) {
            showError(extractErr(e) || "Có lỗi khi gửi yêu cầu.");
        } finally {
            setConfirmOpen(false);
            setLoading(false);
        }
    };

    return (
        <div>
            <section className="content-header">
                <h1>Rời lớp &amp; rời trung tâm</h1>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Chọn lớp</h3>
                    </div>
                    <div className="box-body">
                        <ClassSearchInput onChange={handleSelectClass} />
                    </div>
                </div>

                {loading && <div className="callout callout-info">Đang tải dữ liệu…</div>}

                {students.length > 0 && (
                    <div className="box box-info">
                        <div className="box-header with-border">
                            <h3 className="box-title">Danh sách học sinh</h3>
                        </div>
                        <div className="box-body table-responsive">
                            <table className="table table-bordered">
                                <thead>
                                    <tr>
                                        {/* Ẩn cột tích */}
                                        <th style={{ display: "none" }}></th>
                                        <th>Họ tên</th>
                                        <th>Email</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s) => {
                                        const id = s.studentId ?? s.StudentId;
                                        const note = s.note ?? s.Note ?? "";
                                        const selectable = (s.selectable ?? s.Selectable) === true;

                                        const disabled = !selectable;
                                        const fallbackChecked = selectable;
                                        const isChecked = (checked[id] ?? fallbackChecked) === true;

                                        return (
                                            <tr key={id}>
                                                {/* Ẩn cột checkbox */}
                                                <td style={{ display: "none" }}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={disabled}
                                                        checked={isChecked}
                                                        onChange={() => handleToggle(id)}
                                                    />
                                                </td>
                                                <td>{s.fullName ?? s.FullName}</td>
                                                <td>{s.email ?? s.Email}</td>
                                                <td>{note}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>


                            <div className="mt-2">
                                Đã chọn {countChecked}/{totalInClass} học sinh
                            </div>

                            <button
                                className="btn btn-danger"
                                onClick={askConfirm}
                                disabled={countChecked === 0 || loading}
                                title={countChecked === 0 ? "Chọn ít nhất 1 học sinh hợp lệ" : "Xác nhận rời"}
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal xác nhận — căn giữa, tiêu đề in đậm */}
                <ConfirmDialog
                    open={confirmOpen}
                    type="danger"
                    title="Xác nhận rời trung tâm"
                    message={`Xác nhận cho ${countChecked}/${totalInClass} học sinh rời trung tâm?`}
                    details="Lớp sẽ bị tắt. Tất cả học sinh còn lại sẽ bị rời lớp"
                    confirmText="Xác nhận"
                    cancelText="Xem lại"
                    onCancel={() => setConfirmOpen(false)}
                    onConfirm={handleSubmit}
                    busy={loading}
                />

                {/* Toasts dùng chung */}
                <Toasts />
            </section>
        </div>
    );
}
