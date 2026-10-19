import { HttpError } from '../lib/errors.ts';
import type { PaymentGateway } from './types.ts';

/**
 * Development-only gateway. It never marks anything paid on its own: settlement happens only through
 * the demo endpoint (`POST /api/dev/payments/:id/simulate`), which does not exist in production.
 */
export function simulatorGateway(): PaymentGateway {
  return {
    name: 'SIMULATOR',
    async createCharge() {
      return {};
    },
    parseWebhook() {
      throw new HttpError(404, 'Webhook tidak tersedia untuk simulator.');
    },
    async fetchStatus() {
      return null;
    },
  };
}
