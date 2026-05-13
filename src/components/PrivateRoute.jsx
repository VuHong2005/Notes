import { useEffect, useState } from "react";
import { getUser } from "../services/auth";
import { Navigate } from "react-router-dom";

function PrivateRoute({ children }) {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getUser().then((u) => {
            setUser(u);
            setLoading(false);
        });
    }, []);

    if (loading) return <div>Loading...</div>;

    return user ? children : <Navigate to="/login" />;
}

export default PrivateRoute;