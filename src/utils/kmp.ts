// src/utils/kmp.ts

export function KMP(pattern: string, text: string): boolean {
  if (!pattern || !text) return false; // Handle edge cases
  
  const lps = buildLPS(pattern); // Build partial match table
  let i = 0; // Index for text
  let j = 0; // Index for pattern

  while (i < text.length) {
      if (pattern[j] === text[i]) {
          j++;
          i++;
      }

      if (j === pattern.length) {
          return true; // Found match
      } else if (i < text.length && pattern[j] !== text[i]) {
          j = j !== 0 ? lps[j - 1] : 0;
      }
  }

  return false; // No match found
}

function buildLPS(pattern: string): number[] {
  const lps = new Array(pattern.length).fill(0);
  let length = 0;
  let i = 1;

  while (i < pattern.length) {
      if (pattern[i] === pattern[length]) {
          length++;
          lps[i] = length;
          i++;
      } else {
          length = length !== 0 ? lps[length - 1] : 0;
          if (length === 0) i++;
      }
  }

  return lps;
}
