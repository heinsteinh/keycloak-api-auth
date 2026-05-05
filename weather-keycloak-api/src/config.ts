import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadEnv({ path: resolve(process.cwd(), '../.env'), quiet: true });
loadEnv({ quiet: true });

const ConfigSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
});

export const config = ConfigSchema.parse(process.env);