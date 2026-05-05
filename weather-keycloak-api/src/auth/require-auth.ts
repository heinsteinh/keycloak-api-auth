import { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, AuthenticatedUser } from "./keycload.js";

declare module "fastify" {
    export interface FastifyRequest {
        user?: AuthenticatedUser;
    }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    try {
        const user = await verifyAccessToken(token);
        request.user = user; // Attach user info to the request object
    } catch (error) {
        reply.status(401).send({
             error: 'Invalid token',
             message : 'Token verification failed'
            });
    }
}

export function requireRole(role: string) {
    return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'User not authenticated' });
        }

        if (!request.user.roles.includes(role)) {
            return reply.status(403).send({ error: 'Forbidden', message: `User does not have required role: ${role}` });
        }
    }
}
