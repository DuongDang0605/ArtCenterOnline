// src/Template/Class/ClassSearchInput.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { searchClasses } from "./classes";

/**
 * ClassSearchInput
 * Props:
 *   value: { classId, className, branch } | null
 *   onChange(v): nhận object đã chọn hoặc null
 *   placeholder?: string
 *   inputClassName?: string
 *   dropdownMax?: number (mặc định 12)
 *   style?: CSSProperties
 */
export default function ClassSearchInput({
    value,
    onChange,
    placeholder = "Nhập tên lớp…",
    inputClassName = "form-control input-sm",
    dropdownMax = 12,
    style
}) {
    const [query, setQuery] = useState(value?.className || "");
    const [suggestions, setSuggestions] = useState([]);
    const [openDrop, setOpenDrop] = useState(false);
    const [hoverIndex, setHoverIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const autoRef = useRef(null);

    // đóng dropdown khi click ra ngoài (giống StudentCalendarPage)
    useEffect(() => {
        const onDocClick = (e) => {
            if (!autoRef.current) return;
            if (!autoRef.current.contains(e.target)) {
                setOpenDrop(false);
                setHoverIndex(-1);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // tải gợi ý khi gõ (debounce nhẹ bằng cờ loading)
    useEffect(() => {
        let alive = true;
        (async () => {

            const q = query.trim().toLowerCase();
                  if (!q || value) {            // nếu đã chọn lớp -> ẩn gợi ý
                          if (alive) setSuggestions([]);
                          return;
                      }
            try {
                const res = await searchClasses(q);
                      if (!alive) return;
                      const arr = Array.isArray(res) ? res : [];
                     const filtered = arr.filter(cls => {
                           const name = String(cls.className ?? cls.ClassName ?? cls.name ?? "").toLowerCase();
                            const idStr = String(cls.classId ?? cls.classID ?? cls.ClassID ?? cls.id ?? "").toLowerCase();
                           return name.includes(q) || idStr.includes(q);
                          }).slice(0, dropdownMax);
                      setSuggestions(filtered);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [query, value, dropdownMax]);

    function selectClass(cls) {
        const obj = {
            classId: cls.classId ?? cls.classID ?? cls.ClassID ?? cls.id,
            className: cls.className ?? cls.ClassName ?? cls.name,
            branch: cls.branch ?? cls.Branch ?? ""
        };
        onChange?.(obj);
        setQuery(obj.className || "");
        setOpenDrop(false);
        setHoverIndex(-1);
    }

    const dropdownItems = useMemo(() => suggestions, [suggestions]);

    return (
        <div
            ref={autoRef}
            className="dropdown"
            style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, ...(style || {}) }}
        >
            <div style={{ position: "relative" }}>
                <input
                    className={inputClassName}
                    style={{ width: 280, paddingRight: 26 }}
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        const v = e.target.value;
                        setQuery(v);
                        setOpenDrop(true);
                        // hủy chọn lớp khi người dùng gõ lại — giống file học sinh
                        if (value) onChange?.(null);
                    }}
                    onFocus={() => {
                        if (query.trim()) setOpenDrop(true);
                    }}
                    onKeyDown={(e) => {
                        if (!openDrop && (e.key === "ArrowDown" || e.key === "Enter")) {
                            setOpenDrop(true);
                            return;
                        }
                        if (!openDrop || dropdownItems.length === 0) return;

                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHoverIndex((p) => (p + 1) % dropdownItems.length);
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHoverIndex((p) => (p - 1 + dropdownItems.length) % dropdownItems.length);
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            const pick = hoverIndex >= 0 ? hoverIndex : (dropdownItems.length === 1 ? 0 : -1);
                            if (pick >= 0) selectClass(dropdownItems[pick]);
                        } else if (e.key === "Escape") {
                            setOpenDrop(false);
                            setHoverIndex(-1);
                        }
                    }}
                />
                {/* nút xóa nhanh */}
                {query && (
                    <button
                        type="button"
                        title="Xóa"
                        className="btn btn-link btn-xs"
                        style={{
                            position: "absolute",
                            right: 2,
                            top: "50%",
                            transform: "translateY(-50%)",
                            textDecoration: "none",
                        }}
                        onClick={() => {
                            setQuery("");
                            setHoverIndex(-1);
                            setOpenDrop(false);
                            onChange?.(null);
                        }}
                    >
                        <i className="fa fa-times text-muted" />
                    </button>
                )}

                {/* dropdown gợi ý */}
                {openDrop && query.trim() && (
                    <ul
                        className="dropdown-menu"
                        style={{
                            display: "block",
                            position: "absolute",
                            left: 0,
                            top: "100%",
                            width: 280,
                            maxHeight: 260,
                            overflowY: "auto",
                            marginTop: 2,
                        }}
                    >
                        {loading && (
                            <li className="disabled">
                                <a href="#!" onClick={(e) => e.preventDefault()}>
                                    <i className="fa fa-spinner fa-spin" /> Đang tìm lớp…
                                </a>
                            </li>
                        )}
                        {!loading && dropdownItems.length === 0 && (
                            <li className="disabled">
                                <a href="#!" onClick={(e) => e.preventDefault()}>
                                    Không tìm thấy lớp phù hợp
                                </a>
                            </li>
                        )}
                        {!loading && dropdownItems.map((cls, idx) => {
                            const id = cls.classId ?? cls.classID ?? cls.ClassID ?? cls.id;
                            const name = cls.className ?? cls.ClassName ?? cls.name;
                            const branch = cls.branch ?? cls.Branch ?? "";
                            const active = idx === hoverIndex;
                            return (
                                <li key={id} className={active ? "active" : ""} style={{ cursor: "pointer" }}>
                                    <a
                                        href="#!"
                                        onClick={(e) => { e.preventDefault(); selectClass(cls); }}
                                        onMouseEnter={() => setHoverIndex(idx)}
                                    >
                                        <div style={{ fontWeight: 600 }}>{name}</div>
                                        <div className="text-muted small">ID: {String(id)} {branch ? `• ${branch}` : ""}</div>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
