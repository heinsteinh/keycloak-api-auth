import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider';
import { api } from '../api/client';

type WeatherData = {
  location: string;
  temperatureCelsius: number;
  condition: string;
};

export function Weather() {
  const { token } = useContext(AuthContext);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!token) return;

    api
      .get('/api/weather', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => setWeather(res.data))
      .catch((err) => console.error(err));
  }, [token]);

  if (!weather) {
    return <div className="text-gray-500">Loading weather...</div>;
  }

  return (
    <div className="bg-white shadow-lg rounded-xl p-6">
      <h2 className="text-xl font-bold mb-2">{weather.location}</h2>
      <p className="text-3xl">{weather.temperatureCelsius}°C</p>
      <p className="text-gray-600">{weather.condition}</p>
    </div>
  );
}
