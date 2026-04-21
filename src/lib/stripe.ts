import Stripe from 'stripe';
import { getEnv } from '@/lib/env';

export function stripePlatform() {
  const env = getEnv();
  return {
    stripe: new Stripe(env.STRIPE_SECRET_KEY),
    connectedAccountId: env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID,
  };
}

