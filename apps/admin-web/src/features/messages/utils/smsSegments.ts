/**
 * Calculate Twilio SMS segments and character count
 * Based on GSM-7 and Unicode (UCS-2) encoding
 * 
 * GSM-7: 160 chars single segment, 153 chars per segment for multi-segment
 * Unicode: 70 chars single segment, 67 chars per segment for multi-segment
 */

/**
 * Check if a message can be encoded in GSM-7
 * Returns true if all characters are GSM-7 compatible
 * 
 * Simplified approach: Check for characters that definitely trigger Unicode encoding
 * If none found, assume GSM-7 (conservative estimate)
 * 
 * Characters that trigger Unicode:
 * - Emoji and Unicode symbols
 * - Curly quotes and smart punctuation  
 * - Characters outside basic ASCII + Latin-1 range
 */
function isGSM7(message: string): boolean {
  if (message.length === 0) return true;
  
  // Check for emoji and Unicode symbols (definitely not GSM-7)
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]/u;
  if (emojiPattern.test(message)) {
    return false;
  }
  
  // Check for curly quotes and smart punctuation
  const smartPunctuation = /[""]|['']|[…–—]/u;
  if (smartPunctuation.test(message)) {
    return false;
  }
  
  // Check each character - if any is outside Latin-1 range (0x00-0xFF), it's Unicode
  for (let i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);
    
    // Allow common control characters
    if (code === 0x0A || code === 0x0D || code === 0x09) {
      continue;
    }
    
    // If character is outside Latin-1 range (0x00-0xFF), it triggers Unicode
    if (code > 0xFF) {
      return false;
    }
  }
  
  // If we get here, message likely uses GSM-7 (or Latin-1 which Twilio treats as GSM-7)
  return true;
}

/**
 * Calculate SMS segments for a message
 * Returns { segments: number, characters: number }
 */
export function calculateSMSSegments(message: string): { segments: number; characters: number } {
  const characters = message.length;
  
  if (characters === 0) {
    return { segments: 0, characters: 0 };
  }
  
  const isGSM7Encoding = isGSM7(message);
  
  if (isGSM7Encoding) {
    // GSM-7 encoding
    if (characters <= 160) {
      return { segments: 1, characters };
    } else {
      // Multi-segment: 153 characters per segment
      const segments = Math.ceil(characters / 153);
      return { segments, characters };
    }
  } else {
    // Unicode (UCS-2) encoding
    if (characters <= 70) {
      return { segments: 1, characters };
    } else {
      // Multi-segment: 67 characters per segment
      const segments = Math.ceil(characters / 67);
      return { segments, characters };
    }
  }
}
