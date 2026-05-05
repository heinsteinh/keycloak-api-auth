/**
 * Open-Meteo client. No API key required.
 *  - Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=...
 *  - Forecast:  https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current=...
 */

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class CityNotFoundError extends Error {
  constructor(city: string) {
    super(`City not found: ${city}`);
    this.name = 'CityNotFoundError';
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}

type GeocodeHit = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

type ForecastResponse = {
  current?: {
    temperature_2m: number;
    weather_code: number;
  };
};

export type CurrentWeather = {
  location: string;
  temperatureCelsius: number;
  weatherCode: number;
  condition: string;
};

async function geocode(city: string): Promise<GeocodeHit> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new UpstreamError(`Geocoding request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new UpstreamError(`Geocoding returned HTTP ${res.status}`);
  }
  const body = (await res.json()) as { results?: GeocodeHit[] };
  const hit = body.results?.[0];
  if (!hit) throw new CityNotFoundError(city);
  return hit;
}

async function fetchCurrent(lat: number, lon: number): Promise<ForecastResponse> {
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&timezone=auto`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new UpstreamError(`Forecast request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new UpstreamError(`Forecast returned HTTP ${res.status}`);
  }
  return (await res.json()) as ForecastResponse;
}

export async function getCurrentWeather(city: string): Promise<CurrentWeather> {
  const hit = await geocode(city);
  const forecast = await fetchCurrent(hit.latitude, hit.longitude);
  if (!forecast.current) {
    throw new UpstreamError('Forecast response missing "current" payload');
  }

  const labelParts = [hit.name];
  if (hit.admin1 && hit.admin1 !== hit.name) labelParts.push(hit.admin1);
  if (hit.country) labelParts.push(hit.country);

  return {
    location: labelParts.join(', '),
    temperatureCelsius: forecast.current.temperature_2m,
    weatherCode: forecast.current.weather_code,
    condition: weatherCodeToCondition(forecast.current.weather_code),
  };
}

/** WMO weather interpretation codes — see https://open-meteo.com/en/docs */
function weatherCodeToCondition(code: number): string {
  switch (code) {
    case 0:
      return 'Clear sky';
    case 1:
      return 'Mainly clear';
    case 2:
      return 'Partly cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Fog';
    case 51:
    case 53:
    case 55:
      return 'Drizzle';
    case 56:
    case 57:
      return 'Freezing drizzle';
    case 61:
    case 63:
    case 65:
      return 'Rain';
    case 66:
    case 67:
      return 'Freezing rain';
    case 71:
    case 73:
    case 75:
      return 'Snow';
    case 77:
      return 'Snow grains';
    case 80:
    case 81:
    case 82:
      return 'Rain showers';
    case 85:
    case 86:
      return 'Snow showers';
    case 95:
      return 'Thunderstorm';
    case 96:
    case 99:
      return 'Thunderstorm with hail';
    default:
      return 'Unknown';
  }
}
