import crypto from 'crypto';

export async function dispatchWebhook(url: string, payload: unknown, secret?: string | null): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (secret) {
      try {
        const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
        headers['X-Opayque-Signature'] = signature;
      } catch (e) {
        // ignore signing errors and continue
      }
    }

    const res = await fetch(url, { method: 'POST', headers, body });
    return res.ok;
  } catch (err) {
    console.error('dispatchWebhook error', err);
    return false;
  }
}

export default dispatchWebhook;
