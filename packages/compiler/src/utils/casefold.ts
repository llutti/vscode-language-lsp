// LSP é case-insensitive para keywords/símbolos/identificadores.
// Assumimos ASCII para performance. (Unicode pode existir apenas em comentários e strings literais.)
export function casefold(input: string): string {
  // Fast path: if there is no A-Z, return the original string (no allocation).
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      // Found uppercase ASCII, do the full fold.
      const out: string[] = new Array(input.length);
      for (let j = 0; j < input.length; j += 1) {
        const c = input.charCodeAt(j);
        out[j] = c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : input[j]!;
      }
      return out.join('');
    }
  }
  return input;
}
