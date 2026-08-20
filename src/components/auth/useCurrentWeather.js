import { useCallback, useEffect, useRef, useState } from "react";

const WEATHER_CACHE_KEY = "loginCurrentWeather:v2";
const CACHE_DURATION = 15 * 60 * 1000;
const DEFAULT_LOCATION = {
  latitude: 9.9347,
  longitude: 106.3453,
  label: "Trà Vinh",
};

function readWeatherCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_DURATION) return null;
    return cached;
  } catch {
    return null;
  }
}

async function fetchWeather({ latitude, longitude, label }, signal) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
    ].join(","),
    daily: "sunrise,sunset",
    timezone: "auto",
    forecast_days: "1",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error("Không thể tải dữ liệu thời tiết");

  const result = await response.json();
  if (!result.current) throw new Error("Dữ liệu thời tiết không hợp lệ");

  return {
    current: result.current,
    sunrise: result.daily?.sunrise?.[0] || null,
    sunset: result.daily?.sunset?.[0] || null,
    timezone: result.timezone,
    locationLabel: label,
    latitude,
    longitude,
    savedAt: Date.now(),
  };
}

export function useCurrentWeather(enabled) {
  const [cachedWeather] = useState(readWeatherCache);
  const [weather, setWeather] = useState(cachedWeather);
  const [status, setStatus] = useState(cachedWeather ? "ready" : "loading");
  const [error, setError] = useState("");
  const activeLocation = useRef(cachedWeather
    ? {
        latitude: cachedWeather.latitude,
        longitude: cachedWeather.longitude,
        label: cachedWeather.locationLabel,
      }
    : DEFAULT_LOCATION);

  const loadWeather = useCallback(async (location, signal) => {
    const nextWeather = await fetchWeather(location, signal);
    setWeather(nextWeather);
    setStatus("ready");
    setError("");
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(nextWeather));
    } catch {
      // Giao diện vẫn hoạt động nếu trình duyệt chặn localStorage.
    }
    return nextWeather;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const refreshWeather = () => {
      loadWeather(activeLocation.current, controller.signal).catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setStatus((currentStatus) => currentStatus === "ready" ? "ready" : "error");
        setError("Không thể cập nhật dữ liệu thời tiết.");
      });
    };

    if (!cachedWeather) refreshWeather();
    const refreshId = window.setInterval(refreshWeather, CACHE_DURATION);

    return () => {
      controller.abort();
      window.clearInterval(refreshId);
    };
  }, [cachedWeather, enabled, loadWeather]);

  const useDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Thiết bị này không hỗ trợ định vị.");
      return;
    }

    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const controller = new AbortController();
        activeLocation.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Vị trí hiện tại",
        };
        loadWeather(activeLocation.current, controller.signal).catch(() => {
          setStatus(weather ? "ready" : "error");
          setError("Không thể cập nhật thời tiết tại vị trí hiện tại.");
        });
      },
      () => {
        setStatus(weather ? "ready" : "error");
        setError("Bạn chưa cho phép truy cập vị trí.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, [loadWeather, weather]);

  return { weather, status, error, useDeviceLocation };
}
