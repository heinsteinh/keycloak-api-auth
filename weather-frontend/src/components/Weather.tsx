import { useContext, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { AuthContext } from '../auth/AuthProvider';
import { api } from '../api/client';

type WeatherResponse = {
  location: string;
  temperature: string;
  condition: string;
  requestedBy?: {
    id?: string;
    username?: string;
    email?: string;
    roles?: string[];
  };
};

export function Weather() {
  const { token } = useContext(AuthContext);

  const [city, setCity] = useState('');
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchWeather(location?: string) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = location
        ? `/api/weather/${encodeURIComponent(location)}`
        : '/api/weather';
      const res = await api.get<WeatherResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const msg = ax.response?.data?.message ?? ax.message;
      setError(status ? `${status} — ${msg}` : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchWeather();
  }, [token]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = city.trim();
    if (!trimmed) return;
    fetchWeather(trimmed);
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter a city"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !city.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {data && !error && (
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-2">{data.location}</h2>
          <p className="text-4xl font-light">{data.temperature}</p>
          <p className="text-gray-600 mt-1">{data.condition}</p>
          {data.requestedBy?.username && (
            <p className="text-xs text-gray-400 mt-4">
              Requested by{' '}
              <span className="font-medium">{data.requestedBy.username}</span>{' '}
              ({data.requestedBy.roles?.join(', ')})
            </p>
          )}
        </div>
      )}

      {!data && !error && !loading && (
        <p className="text-gray-500 text-center">
          Search for a city to see the weather.
        </p>
      )}
    </div>
  );
}
