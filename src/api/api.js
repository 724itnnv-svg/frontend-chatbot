import axios from "axios";
import { getApiBaseUrl } from "./baseUrl";

export function createApi({ getToken, onAuthFail }) {
    const api = axios.create({ baseURL: getApiBaseUrl() });

    api.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers["ngrok-skip-browser-warning"] = "true";
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
