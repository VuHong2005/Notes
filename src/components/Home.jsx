import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { signOut } from "../services/auth";
import "./notes.css";

function stripMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/^\|.*\|$/gm, "[Bảng]")
        .replace(/\|[-:| ]+\|/g, "")
        .replace(/#{1,6}\s*/g, "")
        .replace(/\*{1,2}(.+?)\*{1,2}/g, "$1")
        .replace(/`{1,3}(.+?)`{1,3}/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/\n+/g, " ")
        .trim();
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const s = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    const d = new Date(s);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.floor((today - noteDay) / 86400000);
    if (diff === 0) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (diff === 1) return "Hôm qua";
    if (diff < 7) return d.toLocaleDateString("vi-VN", { weekday: "long" });
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Home() {
    const [totalCount, setTotalCount] = useState(0);
    const [deletedCount, setDeletedCount] = useState(0);
    const [folders, setFolders] = useState([]);
    const [user, setUser] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem("theme");
        return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // Tìm kiếm
    const [search, setSearch] = useState("");
    const [allNotes, setAllNotes] = useState([]);
    const searchRef = useRef(null);

    // Modal tạo / đổi tên folder
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [folderName, setFolderName] = useState("");
    const [editingFolder, setEditingFolder] = useState(null); // null = tạo mới
    const folderInputRef = useRef(null);

    // Menu 3 chấm của folder
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef(null);

    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.classList.toggle("dark", darkMode);
        localStorage.setItem("theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    // Đóng menu khi click ra ngoài
    useEffect(() => {
        if (!openMenuId) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [openMenuId]);

    const loadData = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) setUser(userData.user);

        // Tất cả notes chưa xóa (dùng để đếm theo folder và tìm kiếm)
        const { data: allData } = await supabase
            .from("notes").select("*").is("deleted_at", null)
            .order("created_at", { ascending: false });
        setAllNotes(allData || []);
        // Chỉ đếm notes không thuộc folder nào
        setTotalCount((allData || []).filter(n => !n.folder_id).length);

        // Số đã xóa
        const { count } = await supabase
            .from("notes").select("*", { count: "exact", head: true })
            .not("deleted_at", "is", null);
        setDeletedCount(count || 0);

        // Folders của user
        if (userData?.user) {
            const { data: foldersData } = await supabase
                .from("folders").select("*")
                .eq("user_id", userData.user.id)
                .order("created_at", { ascending: true });
            setFolders(foldersData || []);
        }
    };

    useEffect(() => {
        (async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) setUser(userData.user);

            const { data: allData } = await supabase
                .from("notes").select("*").is("deleted_at", null)
                .order("created_at", { ascending: false });
            setAllNotes(allData || []);
            setTotalCount((allData || []).filter(n => !n.folder_id).length);

            const { count } = await supabase
                .from("notes").select("*", { count: "exact", head: true })
                .not("deleted_at", "is", null);
            setDeletedCount(count || 0);

            if (userData?.user) {
                const { data: foldersData } = await supabase
                    .from("folders").select("*")
                    .eq("user_id", userData.user.id)
                    .order("created_at", { ascending: true });
                setFolders(foldersData || []);
            }
        })();
    }, []);

    // Focus input khi mở modal
    useEffect(() => {
        if (showFolderModal) {
            setTimeout(() => folderInputRef.current?.focus(), 50);
        }
    }, [showFolderModal]);

    const openCreateFolder = () => {
        setEditingFolder(null);
        setFolderName("");
        setShowFolderModal(true);
    };

    const openRenameFolder = (folder) => {
        setEditingFolder(folder);
        setFolderName(folder.name);
        setShowFolderModal(true);
    };

    const saveFolder = async () => {
        const name = folderName.trim();
        if (!name) return;

        if (editingFolder) {
            // Đổi tên folder
            await supabase.from("folders").update({ name }).eq("id", editingFolder.id);
        } else {
            // Tạo mới folder
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from("folders").insert({ name, user_id: userData.user.id });
        }

        setShowFolderModal(false);
        setFolderName("");
        setEditingFolder(null);
        loadData();
    };

    const deleteFolder = async (folderId) => {
        await supabase.from("folders").delete().eq("id", folderId);
        loadData();
    };

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    // Đếm số notes trong từng folder
    const countInFolder = (folderId) =>
        allNotes.filter(n => n.folder_id === folderId).length;

    // Kết quả tìm kiếm
    const searchResults = search.trim()
        ? allNotes.filter(n =>
            n.title?.toLowerCase().includes(search.toLowerCase()) ||
            n.content?.toLowerCase().includes(search.toLowerCase())
        )
        : [];

    const isSearching = search.trim().length > 0;

    return (
        <div className="notes-app">

            {/* ---- Topbar ---- */}
            <div className="notes-topbar">
                <div className="profile-icon" onClick={() => setShowProfile(true)}>
                    {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || "?"}
                </div>
            </div>

            {/* ---- Modal Profile ---- */}
            {showProfile && (
                <div className="modal-overlay" onClick={() => setShowProfile(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowProfile(false)}>✕</button>
                        <div className="profile-avatar">
                            {user?.user_metadata?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="profile-name">{user?.user_metadata?.full_name}</div>
                        <div className="profile-date">
                            Ngày tạo: {user?.created_at
                                ? new Date(user.created_at).toLocaleDateString("vi-VN") : ""}
                        </div>
                        <div className="theme-toggle-row">
                            <span className="theme-toggle-label">
                                {darkMode ? "🌙 Tối" : "☀️ Sáng"}
                            </span>
                            <button
                                className={`theme-toggle-btn${darkMode ? " on" : ""}`}
                                onClick={() => setDarkMode(p => !p)}
                                aria-label="Chuyển chế độ tối/sáng"
                            />
                        </div>
                        <button className="logout-btn" onClick={handleSignOut}>Đăng xuất</button>
                    </div>
                </div>
            )}

            {/* ---- Modal tạo / đổi tên folder ---- */}
            {showFolderModal && (
                <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowFolderModal(false)}>✕</button>
                        <div className="modal-delete-title">
                            {editingFolder ? "Đổi tên thư mục" : "Thư mục mới"}
                        </div>
                        <input
                            ref={folderInputRef}
                            className="folder-name-input"
                            placeholder="Tên thư mục"
                            value={folderName}
                            onChange={e => setFolderName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveFolder()}
                        />
                        <div className="modal-delete-actions">
                            <button className="modal-delete-cancel" onClick={() => setShowFolderModal(false)}>
                                Hủy
                            </button>
                            <button
                                className="modal-delete-confirm"
                                style={{ background: folderName.trim() ? "#FFD60A" : "#c7c7cc", color: "#000" }}
                                onClick={saveFolder}
                                disabled={!folderName.trim()}
                            >
                                {editingFolder ? "Lưu" : "Tạo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- Header ---- */}
            {!isSearching && (
                <div className="notes-list-header">
                    <h1>Thư mục</h1>
                </div>
            )}

            {/* ---- Thanh tìm kiếm ---- */}
            <div className="notes-search-wrap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    ref={searchRef}
                    className="notes-search"
                    placeholder="Tìm kiếm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {isSearching && (
                    <button
                        className="notes-action-btn"
                        style={{ flexShrink: 0, paddingRight: 4 }}
                        onClick={() => { setSearch(""); searchRef.current?.blur(); }}
                    >
                        Hủy
                    </button>
                )}
            </div>

            {isSearching ? (
                /* ---- Kết quả tìm kiếm ---- */
                <>
                    {searchResults.length === 0 ? (
                        <div className="notes-empty">Không tìm thấy ghi chú</div>
                    ) : (
                        <>
                            <div className="notes-section-label">{searchResults.length} kết quả</div>
                            <div className="notes-list-card">
                                {searchResults.map((note) => (
                                    <Link key={note.id} to={`/note/${note.id}`} className="notes-list-item">
                                        <div className="notes-item-body">
                                            <div className="notes-item-title-row">
                                                <span className="notes-item-title">{note.title || "Ghi chú mới"}</span>
                                                <span className="notes-item-date">{formatDate(note.created_at)}</span>
                                            </div>
                                            <div className="notes-item-preview">
                                                {stripMarkdown(note.content) || "Không có nội dung"}
                                            </div>
                                        </div>
                                        <span className="notes-item-chevron">›</span>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                /* ---- Danh sách thư mục ---- */
                <>
                    <div className="notes-section-label">Thư mục của tôi</div>
                    <div className="notes-list-card" style={{ margin: "0 16px 8px" }}>

                        {/* Tất cả ghi chú */}
                        <div className="home-folder-item" onClick={() => navigate("/notes")}>
                            <div className="home-folder-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                                </svg>
                            </div>
                            <span className="home-folder-label">Ghi chú</span>
                            <span className="home-folder-count">{totalCount}</span>
                            <span className="notes-item-chevron">›</span>
                        </div>

                        {/* ---- Folders người dùng tạo ---- */}
                        {folders.map((folder) => (
                            <div key={folder.id}>
                                <div className="notes-list-item-divider" />
                                <div className="home-folder-item">
                                    <div className="home-folder-icon" onClick={() => navigate(`/folder/${folder.id}`)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                                        </svg>
                                    </div>
                                    <span className="home-folder-label" onClick={() => navigate(`/folder/${folder.id}`)}>
                                        {folder.name}
                                    </span>
                                    <span className="home-folder-count">{countInFolder(folder.id)}</span>

                                    {/* Nút 3 chấm */}
                                    <div className="folder-menu-wrap" ref={openMenuId === folder.id ? menuRef : null}>
                                        <button
                                            className="folder-dots-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (openMenuId === folder.id) { setOpenMenuId(null); return; }
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                setOpenMenuId(folder.id);
                                            }}
                                        >
                                            ⋮
                                        </button>

                                        {openMenuId === folder.id && (
                                            <div className="folder-dropdown" style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}>
                                                <button className="folder-dropdown-item" onClick={() => { setOpenMenuId(null); openRenameFolder(folder); }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                    Đổi tên
                                                </button>
                                                <div className="folder-dropdown-divider" />
                                                <button className="folder-dropdown-item folder-dropdown-delete" onClick={() => { setOpenMenuId(null); deleteFolder(folder.id); }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6l-1 14H6L5 6" />
                                                        <path d="M9 6V4h6v2" />
                                                    </svg>
                                                    Xóa
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <span className="notes-item-chevron" onClick={() => navigate(`/folder/${folder.id}`)}>›</span>
                                </div>
                            </div>
                        ))}

                        {/* Đã xóa gần đây — luôn ở cuối */}
                        <div className="notes-list-item-divider" />
                        <div className="home-folder-item" onClick={() => navigate("/deleted")}>
                            <div className="home-folder-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8" width="22" height="22">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4h6v2" />
                                </svg>
                            </div>
                            <span className="home-folder-label">Đã xóa gần đây</span>
                            <span className="home-folder-count">{deletedCount}</span>
                            <span className="notes-item-chevron">›</span>
                        </div>

                    </div>
                </>
            )}

            <div style={{ height: 80 }} />

            {/* ---- Bottom bar ---- */}
            <div className="notes-bottombar">
                {/* Nút tạo folder mới */}
                <button className="notes-compose-btn" onClick={openCreateFolder}
                    style={{ background: "none", border: "none" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        <line x1="12" y1="11" x2="12" y2="17" />
                        <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                </button>
                <div style={{ width: 40 }} />
            </div>

        </div>
    );
}

export default Home;
