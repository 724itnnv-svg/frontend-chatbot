import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createApi } from "../api/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("authUser");
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem("authUser");
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  const isLoggedIn = !!token;

  function login(userData, tokenData) {
    setUser(userData);
    setToken(tokenData);

    localStorage.setItem("authUser", JSON.stringify(userData));
    localStorage.setItem("token", tokenData);
  }

  function logout(redirect = true) {
    setUser(null);
    setToken(null);

    localStorage.removeItem("authUser");
    localStorage.removeItem("token");

    if (redirect) window.location.href = "/login";
    //navigate("/login");
  }

  function updateUser(partial) {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(partial || {}) };
      try {
        localStorage.setItem("authUser", JSON.stringify(merged));
      } catch (e) {
        console.warn("Không thể lưu authUser vào localStorage:", e);
      }
      return merged;
    });
  }

  // ✅ Chống logout 2 lần liên tục (đỡ spam redirect)
  const didLogoutRef = useRef(false);

  const safeLogout = (redirect = true) => {
    if (didLogoutRef.current) return;
    didLogoutRef.current = true;
    logout(redirect);
  };

  // ✅ Sync state với localStorage
  // - Nếu token/user bị mất => logout về login
  // - Không decode token nữa
  useEffect(() => {
    const syncFromStorage = () => {
      const storedToken = localStorage.getItem("token");
      const storedUserRaw = localStorage.getItem("authUser");

      // Thiếu 1 trong 2 => auth invalid => logout
      if (!storedToken || !storedUserRaw) {
        if (token || user) safeLogout(true);
        return;
      }

      // authUser bị lỗi JSON => logout
      let storedUser;
      try {
        storedUser = JSON.parse(storedUserRaw);
      } catch {
        safeLogout(true);
        return;
      }

      // Nếu localStorage khác state => cập nhật state theo storage
      if (storedToken !== token) setToken(storedToken);
      if (!user || storedUser?._id !== user?._id) setUser(storedUser);
    };

    syncFromStorage();

    const onStorage = (e) => {
      if (e.key === "token" || e.key === "authUser" || e.key === null) {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);

    const poll = setInterval(syncFromStorage, 2000);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);


  // ✅ Tạo api instance: bắt lỗi 401 từ server => logout về login
  const api = useMemo(() => {
    return createApi({
      getToken: () => localStorage.getItem("token"),
      onAuthFail: () => safeLogout(true), // server trả 401 -> gọi cái này
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Verify token mỗi lần vào web (khi app mount) + khi token thay đổi
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const verifySession = async () => {
      try {
        // createApi thường baseURL = /api => gọi "/verify" là ra GET /api/verify
        const res = await api.get("/verify");
        const data = res?.data ?? res; // hỗ trợ cả axios (res.data) và fetch-wrapper (res)

        if (!cancelled && data?.ok && data?.user) {
          // optional: đồng bộ user từ server cho chắc
          setUser((prev) => (prev?._id === data.user?._id ? prev : data.user));
          localStorage.setItem("authUser", JSON.stringify(data.user));
        }
      } catch (err) {
        // 401 sẽ được createApi tự xử lý bằng onAuthFail => safeLogout(true)
        // lỗi mạng/500 thì thôi, không logout để tránh đá oan
      }
    };

    verifySession(); // ✅ chạy ngay lúc vào web

    return () => {
      cancelled = true;
    };
  }, [token, api]);


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn,
        login,
        logout: safeLogout,
        updateUser,
        api,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
