import { z } from 'zod';

const EnvSchema = z.object({
  ADMIN_LOGIN_EMAIL: z.string().email(),
  ADMIN_LOGIN_PASSWORD: z.string().min(8),

  // Used to sign the admin session cookie. If not provided, we fall back to
  // the admin password (still private in Vercel env), but providing a dedicated
  // secret is strongly recommended.
  ADMIN_SESSION_SECRET: z.string().min(16).optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_CONNECT_DESTINATION_ACCOUNT_ID: z.string().optional(),
});

export function getEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid env for Imigra Painel:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment configuration.');
  }
  return parsed.data;
}

