import { supabase } from "./supabaseClient";

// đăng ký
export const signUp = async (email, password, fullName) => {
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName
            }
        }
    });
};

// đăng nhập
export const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({
        email,
        password
    });
};

// đăng xuất
export const signOut = async () => {
    return await supabase.auth.signOut();
};

// lấy user hiện tại
export const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
};