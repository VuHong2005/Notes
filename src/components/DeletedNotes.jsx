import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import "./notes.css";

function DeletedNotes() {
    const [notes, setNotes] = useState([]);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const navigate = useNavigate();

    // Đọc dark mode từ localStorage
    useEffect(() => {
        const saved = localStorage.getItem("theme");
        const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", dark);
    }, []);

    // Lấy danh sách ghi chú đã xóa (có deleted_at)
    useEffect(() => {
        supabase
            .from("notes")
            .select("*")
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .then(({ data }) => setNotes(data || []));
    }, []);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Khôi phục ghi chú (xóa deleted_at)
    const restoreSelected = async () => {
        if (selectedIds.size === 0) return;
        await supabase
            .from("notes")
            .update({ deleted_at: null })
            .in("id", [...selectedIds]);
        setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    // Xóa vĩnh viễn
    const deleteForever = async () => {
        if (selectedIds.size === 0) return;
        await supabase.from("notes").delete().in("id", [...selectedIds]);
        setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const formatDate = (str) => {
        if (!str) return "";
        const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(str) ? str : str + "Z");
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="notes-app">

            {/* ---- Topbar ---- */}
            <div className="notes-topbar">
                <button className="notes-back-btn" onClick={() => navigate("/")}>
                    <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 16 }}>
                        <path d="M8 1L2 8l6 7"/>
                    </svg>
                    Thư mục
                </button>
                <div className="notes-topbar-actions">
                    {selectMode ? (
                        <button className="notes-action-btn" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                            Hủy
                        </button>
                    ) : (
                        <button className="notes-action-btn" onClick={() => setSelectMode(true)}>
                            Chọn
                        </button>
                    )}
                </div>
            </div>

            {/* ---- Header ---- */}
            <div className="notes-list-header">
                <h1>Đã xóa gần đây</h1>
            </div>

            {/* ---- Danh sách ---- */}
            {notes.length === 0 ? (
                <div className="notes-empty">Không có ghi chú nào đã xóa</div>
            ) : (
                <div className="notes-list-card" style={{ margin: "0 16px" }}>
                    {notes.map((note, i) => {
                        const checked = selectedIds.has(note.id);
                        return (
                            <div key={note.id}>
                                {selectMode ? (
                                    <div
                                        className={`notes-list-item${checked ? " selected" : ""}`}
                                        onClick={() => toggleSelect(note.id)}
                                    >
                                        <div className={`select-circle${checked ? " checked" : ""}`}>
                                            {checked && (
                                                <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
                                                    <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#fff" strokeWidth="2"
                                                        strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                        <div className="notes-item-body">
                                            <div className="notes-item-title-row">
                                                <span className="notes-item-title">{note.title || "Ghi chú mới"}</span>
                                                <span className="notes-item-date">{formatDate(note.deleted_at)}</span>
                                            </div>
                                            <div className="notes-item-preview">
                                                {note.content?.replace(/\|.*\|/g, "[Bảng]").replace(/\n/g, " ").slice(0, 60) || "Không có nội dung"}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <Link to={`/note/${note.id}`} state={{ backTo: "/deleted", backLabel: "Đã xóa" }} className="notes-list-item">
                                        <div className="notes-item-body">
                                            <div className="notes-item-title-row">
                                                <span className="notes-item-title">{note.title || "Ghi chú mới"}</span>
                                                <span className="notes-item-date">{formatDate(note.deleted_at)}</span>
                                            </div>
                                            <div className="notes-item-preview">
                                                {note.content?.replace(/\|.*\|/g, "[Bảng]").replace(/\n/g, " ").slice(0, 60) || "Không có nội dung"}
                                            </div>
                                        </div>
                                        <span className="notes-item-chevron">›</span>
                                    </Link>
                                )}
                                {i < notes.length - 1 && <div className="notes-list-item-divider" />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ---- Bottom bar khi select mode ---- */}
            {selectMode && (
                <div className="notes-bottombar" style={{ justifyContent: "space-between" }}>
                    <button
                        className={`select-delete-btn${selectedIds.size === 0 ? " disabled" : ""}`}
                        onClick={restoreSelected}
                        disabled={selectedIds.size === 0}
                    >
                        Khôi phục
                    </button>
                    <span className="notes-count">
                        {selectedIds.size > 0 ? `${selectedIds.size} đã chọn` : "Chưa chọn"}
                    </span>
                    <button
                        className={`select-delete-btn${selectedIds.size === 0 ? " disabled" : ""}`}
                        style={{ color: selectedIds.size > 0 ? "#ff3b30" : undefined }}
                        onClick={deleteForever}
                        disabled={selectedIds.size === 0}
                    >
                        Xóa vĩnh viễn
                    </button>
                </div>
            )}

        </div>
    );
}

export default DeletedNotes;
