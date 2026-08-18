import { useEffect, useState } from "react";
import { getWeatherVisual } from "./weatherVisual.js";

function seededValue(index, salt) {
  const value = Math.sin(index * 8147.17 + salt * 61.73) * 43758.5453;
  return value - Math.floor(value);
}

function getSunPosition(now, sunrise, sunset) {
  const sunriseTime = sunrise ? new Date(sunrise).getTime() : NaN;
  const sunsetTime = sunset ? new Date(sunset).getTime() : NaN;

  if (!Number.isFinite(sunriseTime) || !Number.isFinite(sunsetTime) || sunsetTime <= sunriseTime) {
    const hourProgress = (new Date(now).getHours() * 60 + new Date(now).getMinutes()) / (24 * 60);
    return { left: 8 + hourProgress * 84, top: 65 - Math.sin(Math.PI * hourProgress) * 52 };
  }

  const progress = Math.min(1, Math.max(0, (now - sunriseTime) / (sunsetTime - sunriseTime)));
  return {
    left: 8 + progress * 84,
    top: 68 - Math.sin(Math.PI * progress) * 56,
  };
}

function WeatherCloud({ className = "", style }) {
  return <span className={`weather-cloud absolute ${className}`} style={style} />;
}

export function WeatherBackground({ weather, requestedScene }) {
  const [now, setNow] = useState(Date.now());
  const visual = getWeatherVisual(weather, requestedScene);
  const sunPosition = getSunPosition(now, weather?.sunrise, weather?.sunset);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const skyClass = visual.isDay
    ? {
        clear: "from-sky-500 via-sky-300 to-cyan-100",
        "partly-cloudy": "from-sky-500 via-sky-300 to-slate-100",
        cloudy: "from-slate-500 via-slate-400 to-slate-200",
        rain: "from-slate-700 via-slate-500 to-sky-300",
        storm: "from-slate-950 via-slate-700 to-indigo-400",
        fog: "from-slate-400 via-slate-300 to-slate-100",
        snow: "from-slate-500 via-sky-300 to-slate-100",
      }[visual.scene]
    : {
        clear: "from-slate-950 via-indigo-950 to-slate-800",
        "partly-cloudy": "from-slate-950 via-indigo-950 to-slate-700",
        cloudy: "from-slate-950 via-slate-800 to-slate-600",
        rain: "from-slate-950 via-slate-800 to-blue-950",
        storm: "from-black via-slate-950 to-indigo-950",
        fog: "from-slate-950 via-slate-700 to-slate-500",
        snow: "from-slate-950 via-indigo-900 to-sky-800",
      }[visual.scene];

  const showSun = visual.isDay && ["clear", "partly-cloudy"].includes(visual.scene);
  const showMoon = !visual.isDay && ["clear", "partly-cloudy"].includes(visual.scene);
  const showClouds = visual.scene !== "clear";
  const showRain = ["rain", "storm"].includes(visual.scene);

  return (
    <div className={`weather-scene absolute inset-0 z-0 overflow-hidden bg-gradient-to-b ${skyClass}`} aria-hidden="true">
      {!visual.isDay && (
        <div className="absolute inset-0 opacity-70">
          {Array.from({ length: 38 }, (_, index) => (
            <span
              key={index}
              className="weather-star absolute h-0.5 w-0.5 rounded-full bg-white"
              style={{ left: `${seededValue(index, 1) * 100}%`, top: `${seededValue(index, 2) * 68}%`, animationDelay: `${seededValue(index, 3) * -4}s` }}
            />
          ))}
        </div>
      )}

      {showSun && (
        <div
          className="weather-sun absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100 shadow-[0_0_55px_22px_rgba(253,224,71,0.65)] transition-[left,top] duration-[60000ms] ease-linear sm:h-32 sm:w-32"
          style={{ left: `${sunPosition.left}%`, top: `${sunPosition.top}%` }}
        />
      )}

      {showMoon && (
        <div className="weather-moon absolute right-[12%] top-[12%] h-20 w-20 rounded-full bg-slate-100 shadow-[0_0_35px_12px_rgba(226,232,240,0.28)] sm:h-28 sm:w-28" />
      )}

      {showClouds && (
        <div className={`absolute inset-0 ${visual.scene === "partly-cloudy" ? "opacity-65" : "opacity-90"}`}>
          <WeatherCloud className="top-[13%]" style={{ "--cloud-scale": 1.2, "--cloud-duration": "34s", "--cloud-delay": "-8s" }} />
          <WeatherCloud className="top-[31%]" style={{ "--cloud-scale": 0.8, "--cloud-duration": "43s", "--cloud-delay": "-27s" }} />
          <WeatherCloud className="top-[55%]" style={{ "--cloud-scale": 1.5, "--cloud-duration": "52s", "--cloud-delay": "-18s" }} />
        </div>
      )}

      {showRain && (
        <div className="weather-precipitation absolute inset-0">
          {Array.from({ length: visual.scene === "storm" ? 70 : 48 }, (_, index) => (
            <span
              key={index}
              className="weather-rain absolute -top-16 h-16 w-px bg-gradient-to-b from-transparent to-sky-100/80"
              style={{
                left: `${seededValue(index, 4) * 100}%`,
                animationDuration: `${0.65 + seededValue(index, 5) * 0.45}s`,
                animationDelay: `${seededValue(index, 6) * -2}s`,
                opacity: 0.35 + seededValue(index, 7) * 0.55,
              }}
            />
          ))}
        </div>
      )}

      {visual.scene === "snow" && (
        <div className="weather-precipitation absolute inset-0">
          {Array.from({ length: 42 }, (_, index) => (
            <span
              key={index}
              className="weather-snow absolute -top-8 rounded-full bg-white shadow-[0_0_7px_white]"
              style={{
                left: `${seededValue(index, 8) * 100}%`,
                width: `${4 + seededValue(index, 9) * 7}px`,
                height: `${4 + seededValue(index, 9) * 7}px`,
                animationDuration: `${7 + seededValue(index, 10) * 8}s`,
                animationDelay: `${seededValue(index, 11) * -10}s`,
              }}
            />
          ))}
        </div>
      )}

      {visual.scene === "fog" && (
        <div className="absolute inset-0">
          <span className="weather-fog absolute left-[-20%] top-[18%] h-28 w-[140%] rounded-full bg-white/25 blur-3xl" />
          <span className="weather-fog absolute left-[-30%] top-[48%] h-36 w-[150%] rounded-full bg-white/30 blur-3xl [animation-delay:-9s]" />
          <span className="weather-fog absolute left-[-15%] top-[75%] h-24 w-[130%] rounded-full bg-white/20 blur-3xl [animation-delay:-16s]" />
        </div>
      )}

      {visual.scene === "storm" && <div className="weather-lightning absolute inset-0 bg-white/70 opacity-0" />}
      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-slate-950/30 to-transparent" />

      <style>{`
        .weather-cloud {
          left: -220px;
          width: 180px;
          height: 58px;
          border-radius: 999px;
          background: rgba(241, 245, 249, 0.78);
          box-shadow: 55px -25px 0 4px rgba(241, 245, 249, 0.78), 112px -5px 0 -2px rgba(241, 245, 249, 0.78);
          transform: scale(var(--cloud-scale));
          animation: weatherCloudMove var(--cloud-duration) linear var(--cloud-delay) infinite;
        }
        .weather-star { animation: weatherTwinkle 3s ease-in-out infinite; }
        .weather-rain { animation: weatherRainFall linear infinite; transform: rotate(10deg); }
        .weather-snow { animation: weatherSnowFall linear infinite; }
        .weather-fog { animation: weatherFogMove 26s ease-in-out infinite alternate; }
        .weather-lightning { animation: weatherLightning 8s steps(1) infinite; }

        @keyframes weatherCloudMove { to { left: calc(100% + 260px); } }
        @keyframes weatherTwinkle { 50% { opacity: 0.2; transform: scale(0.7); } }
        @keyframes weatherRainFall { to { transform: translate3d(-28px, calc(100vh + 100px), 0) rotate(10deg); } }
        @keyframes weatherSnowFall { to { transform: translate3d(45px, calc(100vh + 70px), 0) rotate(240deg); } }
        @keyframes weatherFogMove { from { transform: translateX(-5%); } to { transform: translateX(8%); } }
        @keyframes weatherLightning { 0%, 91%, 94%, 100% { opacity: 0; } 92%, 93% { opacity: 0.55; } }

        @media (prefers-reduced-motion: reduce) {
          .weather-cloud, .weather-star, .weather-rain, .weather-snow, .weather-fog, .weather-lightning {
            animation: none !important;
          }
          .weather-precipitation { display: none; }
        }
      `}</style>
    </div>
  );
}
