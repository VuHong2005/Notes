import { useState } from "react";
import { signUp } from "../services/auth";
import { useNavigate, Link } from "react-router-dom";
import "./notes.css";

function Register() {

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleRegister = async () => {

        const { error } = await signUp(email, password, fullName);

        if (error) {
            alert(error.message);
        } else {
            alert("Đăng ký thành công!");
            navigate("/login");
        }
    };

    return (
        <div className="auth-bg">
            <div className="auth-card">

                <div className="auth-logo">
                    <svg viewBox="0 0 52 52" fill="none">
                        <rect width="52" height="52" rx="13" fill="#FFD60A"/>
                        <path d="M14 16h24M14 24h16M14 32h20" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                </div>

                <h1 className="auth-title">Tạo tài khoản</h1>
                <p className="auth-subtitle">Bắt đầu ghi chú ngay hôm nay</p>

                <div className="auth-fields">
                    <div className="auth-field">
                        <input
                            placeholder="Họ tên"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div className="auth-field">
                        <input
                            placeholder="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="auth-field">
                        <input
                            placeholder="Mật khẩu"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <button className="auth-btn" onClick={handleRegister}>Đăng ký</button>

                <div className="auth-link-row">
                    Đã có tài khoản?{" "}
                    <Link to="/login">Đăng nhập</Link>
                </div>

            </div>
        </div>
    );
}

export default Register;

