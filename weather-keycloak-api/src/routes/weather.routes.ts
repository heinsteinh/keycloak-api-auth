import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/require-auth.js";
import { id } from "zod/locales";

export async function weatherRoutes(app: FastifyInstance) {
    app.get(
        '/api/weather',
        {
            preHandler: [requireAuth, requireRole('weather:read')] 
        },
        async (request) => {
          return {
                location: 'New York',
                temperature: '15°C',
                condition: 'Cloudy',
                requestedBy: {
                    id: request.user?.sub,
                    username: request.user?.username,
                    email: request.user?.email,
                    roles: request.user?.roles
                }
            };
    });


    app.get(
        '/api/weather/:location',
        {
            preHandler: [requireAuth, requireRole('weather:read')]
        },
        async (request) => {
            const { location } = request.params as { location: string };
            return {
                location,
                temperature: '20°C',
                condition: 'Sunny',
                requestedBy: {
                    id: request.user?.sub,
                    username: request.user?.username,
                    email: request.user?.email,
                    roles: request.user?.roles
                }
            };
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