import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateOTP(length = 6): string {
  const digits = '0123456789';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => digits[n % digits.length]).join('');
}

export function otpExpiresAt(minutesFromNow = 30): string {
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + minutesFromNow);
  return expires.toISOString();
}
