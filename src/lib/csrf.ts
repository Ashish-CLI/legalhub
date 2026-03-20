import crypto from 'crypto';

const CSRF_SECRET = process.env.JWT_SECRET || 'csrf-fallback-secret';


export function generateCsrfToken(): string {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(timestamp);
  const signature = hmac.digest('hex');
  return `${timestamp}.${signature}`;
}

export function verifyCsrfToken(token: string, maxAgeMs: number = 60 * 60 * 1000): boolean {
  if (!token || !token.includes('.')) return false;

  const [timestamp, signature] = token.split('.');
  const ts = parseInt(timestamp, 10);

  if (isNaN(ts)) return false;

  if (Date.now() - ts > maxAgeMs) return false;

  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(timestamp);
  const expectedSignature = hmac.digest('hex');

  if (signature.length !== expectedSignature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
