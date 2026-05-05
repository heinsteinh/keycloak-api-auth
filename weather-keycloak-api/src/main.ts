import Fastify  from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.routes.js";
import { weatherRoutes } from "./routes/weather.routes.js";

const app = Fastify({
    logger: true,
});

app.register(helmet);
app.register(cors, {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
});

app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
});

app.register(healthRoutes);
app.register(weatherRoutes);

const start = async () => {
    try {
        await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
        console.log(`Server is running on port ${config.API_PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
