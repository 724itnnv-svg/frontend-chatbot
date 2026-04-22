import axios from "axios";

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5173",
    timeout: 30000,
});

export default axiosClient;
