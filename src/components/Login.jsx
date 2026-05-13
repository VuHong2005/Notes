import { useState } from "react";
import { signIn } from "../services/auth";
import { useNavigate, Link } from "react-router-dom";
import "./notes.css";

function Login() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = async () => {

        const { data, error } = await signIn(email, password);

        console.log("DATA:", data);
        console.log("ERROR:", error);

        if (error) {
            alert(error.message);
        } else {
            navigate("/");
        }
    };

    return (
        <div className="auth-bg">
            <div className="auth-card">

                <div className="auth-logo">
                    <svg viewBox="0 0 52 52" fill="none">
                        <rect width="52" height="52" rx="13" fill="#FFD60A" />
                        <path d="M14 16h24M14 24h16M14 32h20" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </div>

                <h1 className="auth-title">Ghi chú</h1>
                <p className="auth-subtitle">Đăng nhập để tiếp tục</p>

                <div className="auth-fields">
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

                <button className="auth-btn" onClick={handleLogin}>Đăng nhập</button>

                <div className="auth-link-row">
                    Chưa có tài khoản?{" "}
                    <Link to="/register">Đăng ký</Link>
                </div>

            </div>
        </div>
    );
}

export default Login;

