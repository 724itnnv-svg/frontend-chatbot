import axios from "axios";

export function createApi({ getToken, onAuthFail }) {
    const api = axios.create({ baseURL: "/api" });

    api.interceptors.request.use((config) => {
        const token = getToken?.();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    });

    api.interceptors.response.use(
        (res) => res,
        (err) => {
            if (err.response?.status === 401) {
                onAuthFail?.(); // ✅ logout về login
            }
            return Promise.reject(err);
        }
    );

    return api;
}
