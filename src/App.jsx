import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import NotesList from "./components/NotesList";
import AddNote from "./components/AddNote";
import NoteDetail from "./components/NoteDetail";
import DeletedNotes from "./components/DeletedNotes";
import FolderNotes from "./components/FolderNotes";
import Login from "./components/Login";
import Register from "./components/Register";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Trang chủ — thư mục */}
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />

        {/* Tất cả ghi chú */}
        <Route path="/notes" element={<PrivateRoute><NotesList /></PrivateRoute>} />

        {/* Đã xóa gần đây */}
        <Route path="/deleted" element={<PrivateRoute><DeletedNotes /></PrivateRoute>} />

        {/* Tạo mới */}
        <Route path="/add" element={<PrivateRoute><AddNote /></PrivateRoute>} />

        {/* Xem notes trong folder */}
        <Route path="/folder/:id" element={<PrivateRoute><FolderNotes /></PrivateRoute>} />

        {/* Chi tiết ghi chú */}
        <Route path="/note/:id" element={<PrivateRoute><NoteDetail /></PrivateRoute>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
