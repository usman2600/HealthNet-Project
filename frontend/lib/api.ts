import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://healthnet-project-production.up.railway.app/api"; // Android emulator → localhost; change for physical device

const api = axios.create({ baseURL: API_BASE, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.description ||
      (err.response ? `Server error (${err.response.status})` : "Network error. Check your connection.");
    return Promise.reject(new Error(message));
  },
);

export default api;
