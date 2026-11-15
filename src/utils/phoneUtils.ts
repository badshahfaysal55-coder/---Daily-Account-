/**
 * Phone and WhatsApp normalization utilities
 * Supports Bangladesh (+880) and Saudi Arabia (+966)
 */

export function cleanDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[^0-9]/g, '');
}

/**
 * Normalizes a phone number to standard international digit format (without leading '+')
 * e.g.
 * - "+880 1711-234567" -> "8801711234567"
 * - "01711234567" -> "8801711234567"
 * - "+966 50 123 4567" -> "966501234567"
 * - "0501234567" -> "966501234567"
 */
export function normalizePhoneNumber(phone: string, defaultCountry: 'BD' | 'KSA' = 'BD'): string {
  if (!phone) return '';
  const digits = cleanDigits(phone);

  // If already starts with Bangladesh code 880
  if (digits.startsWith('880')) {
    return digits;
  }
  // Local BD format 01X XXXX XXXX (11 digits)
  if (digits.startsWith('01') && digits.length === 11) {
    return '88' + digits;
  }
  // Local BD format 1X XXXX XXXX (10 digits)
  if (digits.startsWith('1') && digits.length === 10 && defaultCountry === 'BD') {
    return '880' + digits;
  }

  // If starts with Saudi code 966
  if (digits.startsWith('966')) {
    return digits;
  }
  // Local Saudi format 05X XXX XXXX (10 digits)
  if (digits.startsWith('05') && digits.length === 10) {
    return '966' + digits.slice(1);
  }
  // Local Saudi format 5X XXX XXXX (9 digits)
  if (digits.startsWith('5') && digits.length === 9 && defaultCountry === 'KSA') {
    return '966' + digits;
  }

  return digits;
}

/**
 * Formats a phone number for attractive visual display
 */
export function formatDisplayPhone(phone: string): string {
  if (!phone) return '';
  const digits = cleanDigits(phone);

  if (digits.startsWith('880') && digits.length >= 13) {
    return `+880 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `+880 ${digits.slice(1, 5)}-${digits.slice(5)}`;
  }
  if (digits.startsWith('966') && digits.length >= 12) {
    return `+966 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith('05') && digits.length === 10) {
    return `+966 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return phone;
}

/**
 * Generates an official WhatsApp click-to-chat URL
 * Using https://wa.me/PHONE_NUMBER
 * Removes spaces, brackets, hyphens, and leading +
 */
export function getWhatsAppUrl(phoneOrWhatsapp: string, prefilledText?: string): string | null {
  if (!phoneOrWhatsapp) return null;
  const normalized = normalizePhoneNumber(phoneOrWhatsapp);
  if (!normalized || normalized.length < 8) return null;

  const baseUrl = `https://wa.me/${normalized}`;
  return prefilledText ? `${baseUrl}?text=${encodeURIComponent(prefilledText)}` : baseUrl;
}

/**
 * Compresses an image client-side via HTML5 Canvas before uploading
 * Max 400x400, quality 0.82 JPEG
 * Returns base64 data URL
 */
export async function compressImageClientSide(file: File, maxDim = 400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into DOM'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context unavailable'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
