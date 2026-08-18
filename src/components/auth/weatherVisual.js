const WEATHER_SCENES = new Set(["clear", "partly-cloudy", "cloudy", "rain", "storm", "fog", "snow", "night"]);

export function getWeatherVisual(weather, requestedScene = "") {
  const forcedScene = WEATHER_SCENES.has(requestedScene) ? requestedScene : "";
  const current = weather?.current;
  const code = Number(current?.weather_code ?? 0);
  const precipitation = Number(current?.precipitation ?? 0);
  const isDay = forcedScene === "night" ? false : current ? current.is_day === 1 : true;

  let scene = forcedScene === "night" ? "clear" : forcedScene;
  if (!scene) {
    if ([95, 96, 99].includes(code)) scene = "storm";
    else if ([71, 73, 75, 77, 85, 86].includes(code) || Number(current?.snowfall) > 0) scene = "snow";
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code) || precipitation > 0) scene = "rain";
    else if ([45, 48].includes(code)) scene = "fog";
    else if (code === 3) scene = "cloudy";
    else if ([1, 2].includes(code)) scene = "partly-cloudy";
    else scene = "clear";
  }

  const presentation = {
    clear: { dayIcon: "☀️", nightIcon: "🌙", description: isDay ? "Trời quang" : "Đêm quang" },
    "partly-cloudy": { dayIcon: "🌤️", nightIcon: "☁️", description: "Mây rải rác" },
    cloudy: { dayIcon: "☁️", nightIcon: "☁️", description: "Nhiều mây" },
    rain: { dayIcon: "🌧️", nightIcon: "🌧️", description: "Trời mưa" },
    storm: { dayIcon: "⛈️", nightIcon: "⛈️", description: "Mưa giông" },
    fog: { dayIcon: "🌫️", nightIcon: "🌫️", description: "Có sương mù" },
    snow: { dayIcon: "🌨️", nightIcon: "🌨️", description: "Có tuyết" },
  }[scene];

  return {
    scene,
    isDay,
    icon: isDay ? presentation.dayIcon : presentation.nightIcon,
    description: presentation.description,
  };
}
