import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import "./notes.css";

function MoveFolderModal({ note, currentFolderId, onMove, onClose }) {
    const [folders, setFolders] = useState([]);
    const [showNewInput, setShowNewInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const newInputRef = useRef(null);

    useEffect(() => {
        supabase.from("folders").select("*").order("created_at", { ascending: true })
            .then(({ data }) => setFolders(data || []));
    }, []);

    useEffect(() => {
        if (showNewInput) setTimeout(() => newInputRef.current?.focus(), 50);
    }, [showNewInput]);

    const createAndMove = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        const { data: userData } = await supabase.auth.getUser();
        const { data: folder } = await supabase
            .from("folders").insert({ name, user_id: userData.user.id }).select().single();
        if (folder) onMove(folder.id);
    };

    return (
        <div className="move-modal-overlay" onClick={onClose}>
            <div className="move-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="move-modal-header">
                    <button className="move-modal-cancel" onClick={onClose}>Hủy</button>
                    <span className="move-modal-title">Chọn một thư mục</span>
                    <div style={{ width: 48 }} />
                </div>

                {/* Note info */}
                <div className="move-modal-note-info">
                    <div className="move-modal-note-thumb">
                        {note?.title && <div className="move-modal-thumb-title">{note.title}</div>}
                        {note?.content && <div className="move-modal-thumb-body">{note.content.replace(/\|.*\|/g, "").replace(/#{1,6}\s*/g, "").replace(/\n+/g, " ").trim().slice(0, 60)}</div>}
                    </div>
                    <div className="move-modal-note-meta">
                        <div className="move-modal-note-title">{note?.title || "Ghi chú mới"}</div>
                        <div className="move-modal-note-sub">1 ghi chú</div>
                    </div>
                </div>

                {/* Section */}
                <div className="move-modal-section-label">Thư mục của tôi</div>

                <div className="move-modal-list">

                    {/* Thư mục mới */}
                    {showNewInput ? (
                        <div className="move-modal-new-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                <line x1="12" y1="11" x2="12" y2="17"/>
                                <line x1="9" y1="14" x2="15" y2="14"/>
                            </svg>
                            <input
                                ref={newInputRef}
                                className="move-modal-new-input"
                                placeholder="Tên thư mục"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && createAndMove()}
                            />
                            <button
                                className="move-modal-new-ok"
                                style={{ opacity: newFolderName.trim() ? 1 : 0.4 }}
                                onClick={createAndMove}
                                disabled={!newFolderName.trim()}
                            >
                                Xong
                            </button>
                        </div>
                    ) : (
                        <button className="move-modal-item move-modal-new-btn" onClick={() => setShowNewInput(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                <line x1="12" y1="11" x2="12" y2="17"/>
                                <line x1="9" y1="14" x2="15" y2="14"/>
                            </svg>
                            <span style={{ color: "#FFD60A" }}>Thư mục mới</span>
                        </button>
                    )}

                    <div className="move-modal-divider" />

                    {/* Tất cả ghi chú — chỉ hiện khi đang trong folder */}
                    {currentFolderId && (
                        <>
                            <button className="move-modal-item" onClick={() => onMove(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                                </svg>
                                <span>Tất cả ghi chú</span>
                            </button>
                            <div className="move-modal-divider" />
                        </>
                    )}

                    {/* Danh sách folder */}
                    {folders.map((f, i) => {
                        const isCurrent = f.id === currentFolderId;
                        return (
                            <div key={f.id}>
                                <button
                                    className={`move-modal-item${isCurrent ? " move-modal-item-disabled" : ""}`}
                                    onClick={() => !isCurrent && onMove(f.id)}
                                    disabled={isCurrent}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke={isCurrent ? "#c7c7cc" : "#FFD60A"} strokeWidth="1.8" width="22" height="22">
                                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                                    </svg>
                                    <span>{f.name}</span>
                                </button>
                                {i < folders.length - 1 && <div className="move-modal-divider" />}
                            </div>
                        );
                    })}
                </div>

            </div>
        </div>
    );
}

export default MoveFolderModal;
