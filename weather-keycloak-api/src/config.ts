import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
});

export const config = ConfigSchema.parse(process.env);