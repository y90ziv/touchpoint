import crypto from 'crypto';
import QRCode from 'qrcode';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateHotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
}

export function generateTotp(secret: string, time: number = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(time / 1000 / 30);
  return generateHotp(key, counter);
}

export function verifyTotp(
  secret: string,
  token: string,
  windowSteps: number = 1,
  time: number = Date.now()
): boolean {
  if (!secret || !token) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  const key = base32Decode(secret);
  const counter = Math.floor(time / 1000 / 30);
  for (let i = -windowSteps; i <= windowSteps; i++) {
    if (generateHotp(key, counter + i) === cleanToken) {
      return true;
    }
  }
  return false;
}

export async function generateTotpSecret(
  email: string
): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  const secretBytes = crypto.randomBytes(20);
  const secret = base32Encode(secretBytes);
  const cleanEmail = encodeURIComponent(email || 'user');
  const otpauthUrl = `otpauth://totp/Touchpoint:${cleanEmail}?secret=${secret}&issuer=Touchpoint&algorithm=SHA1&digits=6&period=30`;

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 250,
  });

  return { secret, otpauthUrl, qrDataUrl };
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateBackupCodes(count: number = 8): {
  plaintextCodes: string[];
  hashedCodes: string[];
} {
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plaintextCodes.push(formatted);
    hashedCodes.push(hashCode(formatted));
  }

  return { plaintextCodes, hashedCodes };
}

export function verifyAndConsumeBackupCode(
  inputCode: string,
  hashedCodesJson: string | null | undefined
): { valid: boolean; remainingHashedCodesJson: string } {
  if (!hashedCodesJson || !inputCode) {
    return { valid: false, remainingHashedCodesJson: hashedCodesJson || '[]' };
  }

  try {
    const hashedCodes = JSON.parse(hashedCodesJson) as string[];
    const targetHash = hashCode(inputCode);
    const index = hashedCodes.indexOf(targetHash);

    if (index === -1) {
      return { valid: false, remainingHashedCodesJson: hashedCodesJson };
    }

    // Remove the used one-time recovery code
    hashedCodes.splice(index, 1);
    return { valid: true, remainingHashedCodesJson: JSON.stringify(hashedCodes) };
  } catch {
    return { valid: false, remainingHashedCodesJson: hashedCodesJson };
  }
}
