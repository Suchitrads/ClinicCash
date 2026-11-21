export interface MessageParts {
  name: string;
  alertMessage: string;
  amount: string;
  dueDate: string;
  upiLink: string;
}

/**
 * Accepts an Indian mobile number and returns the 10 national digits, or null.
 * Strips spaces, '+', and a pasted leading 0 or 91 country prefix.
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function buildQrUrl(upiLink: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
}

export function buildWhatsAppUrl(nationalPhone: string, message: string): string {
  return `https://wa.me/91${nationalPhone}?text=${encodeURIComponent(message)}`;
}

/** Template: "Hello <name>, <alert> Amount due: <amount>, due <date>. Pay via UPI: <upi>. QR: <qr>" (empty parts omitted). */
export function buildMessage(p: MessageParts): string {
  const name = p.name.trim();
  const amount = p.amount.trim();
  const date = p.dueDate.trim();
  const upi = p.upiLink.trim();

  let text = (name ? `Hello ${name}, ` : '') + p.alertMessage.trim();
  if (amount && date) text += ` Amount due: ${amount}, due ${date}.`;
  else if (amount) text += ` Amount due: ${amount}.`;
  else if (date) text += ` Due: ${date}.`;
  if (upi) text += ` Pay via UPI: ${upi}. QR: ${buildQrUrl(upi)}`;
  return text;
}
