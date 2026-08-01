import axios from "axios";
import { getApiBaseUrl } from "./baseUrl";

const axiosClient = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 30000,
    withCredentials: true,
    headers: {
        "ngrok-skip-browser-warning": "true",
    },
});

export default axiosClient;
