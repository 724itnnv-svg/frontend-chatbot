import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createApi } from "../api/api";
import { setupServerPushNotifications } from "../utils/serverPushNotifications";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const didLogoutRef = useRef(false);
  const isLoggedIn = Boolean(user);

  const api = useMemo(
    () =>
      createApi({
        onAuthFail: () => setUser(null),
      }),
    [],
  );

  function login(userData) {
    didLogoutRef.current = false;
    setUser(userData || null);
    setIsAuthReady(true);
  }

  async function logout(redirect = true) {
    setUser(null);

    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.warn("Không thể thu hồi phiên đăng nhập:", error);
    } finally {
      if (redirect) window.location.href = "/login";
    }
  }

  function updateUser(partial) {
    setUser((previous) => ({ ...(previous || {}), ...(partial || {}) }));
  }

  const safeLogout = (redirect = true) => {
    if (didLogoutRef.current) return;
    didLogoutRef.current = true;
    void logout(redirect);
  };

  useEffect(() => {
    // Xóa dữ liệu xác thực của phiên bản cũ; phiên mới chỉ tồn tại trong HttpOnly cookie.
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("authUser");
    } catch {
      // Một số WebView chặn storage; cookie phiên vẫn hoạt động bình thường.
    }

    let cancelled = false;
    const bootstrapSession = async () => {
      try {
        const response = await api.get("/verify");
        const data = response?.data ?? response;
        if (!cancelled && data?.ok && data?.user) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsAuthReady(true);
      }
    };

    void bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!user) return;
    setupServerPushNotifications().catch((error) => {
      console.warn("Không thể thiết lập push notification:", error);
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        // Cờ tương thích cho các component cũ; đây không phải access token.
        token: isLoggedIn ? "cookie-session" : null,
        isLoggedIn,
        isAuthReady,
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
