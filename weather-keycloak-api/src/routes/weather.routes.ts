import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/require-auth.js";
import {
    getCurrentWeather,
    CityNotFoundError,
    UpstreamError,
} from "../weather/openMeteo.js";

const DEFAULT_LOCATION = "New York";

export async function weatherRoutes(app: FastifyInstance) {
    async function respondWithWeather(
        city: string,
        request: import("fastify").FastifyRequest,
        reply: import("fastify").FastifyReply
    ) {
        try {
            const weather = await getCurrentWeather(city);
            return {
                location: weather.location,
                temperature: `${Math.round(weather.temperatureCelsius)}°C`,
                temperatureCelsius: weather.temperatureCelsius,
                condition: weather.condition,
                weatherCode: weather.weatherCode,
                requestedBy: {
                    id: request.user?.sub,
                    username: request.user?.username,
                    email: request.user?.email,
                    roles: request.user?.roles,
                },
            };
        } catch (err) {
            if (err instanceof CityNotFoundError) {
                return reply.status(404).send({
                    error: "Not Found",
                    message: err.message,
                });
            }
            if (err instanceof UpstreamError) {
                request.log.error({ err }, "Open-Meteo upstream failure");
                return reply.status(502).send({
                    error: "Bad Gateway",
                    message: "Weather provider is unavailable",
                });
            }
            throw err;
        }
    }

    app.get(
        '/api/weather',
        {
            preHandler: [requireAuth, requireRole('weather:read')]
        },
        async (request, reply) => respondWithWeather(DEFAULT_LOCATION, request, reply)
    );


    app.get(
        '/api/weather/:location',
        {
            preHandler: [requireAuth, requireRole('weather:read')]
        },
        async (request, reply) => {
            const { location } = request.params as { location: string };
            return respondWithWeather(location, request, reply);
        }
    );

    app.get(
        '/api/weather/admin',
        {
            preHandler: [requireAuth, requireRole('weather:admin')]
        },
        async (request) => {
            return {
                message: 'This is an admin-only weather endpoint.',
                requestedBy: {
                    id: request.user?.sub,
                    username: request.user?.username,
                    email: request.user?.email,
                    roles: request.user?.roles
                }
            };
        }
    );
}
