/**
 * Basit ve etkili bir parçalayıcı: metni paragraflarına ayırıp hedef boyutta
 * parçalar hâlinde birleştirir; hedef boyutu aşan paragrafları cümle
 * sınırlarından böler ve komşu parçalar arasında örtüşme bırakır.
 */

export function chunkText(
  text: string,
  targetSize = 1200,
  overlap = 180
): string[] {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const t = buffer.trim();
    if (t) chunks.push(t);
    buffer = "";
  };

  for (const para of paragraphs) {
    if (para.length > targetSize) {
      flush();
      chunks.push(...splitLongParagraph(para, targetSize, overlap));
      continue;
    }
    if (buffer.length === 0) {
      buffer = para;
    } else if (buffer.length + 2 + para.length <= targetSize) {
      buffer += "\n\n" + para;
    } else {
      flush();
      buffer = para;
    }
  }
  flush();

  // Komşu parçalar arasında bağlam kaybını önlemek için örtüşme ekle.
  if (overlap > 0 && chunks.length > 1) {
    const withOverlap: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].slice(-overlap).trim();
      withOverlap.push(tail ? tail + "\n\n" + chunks[i] : chunks[i]);
    }
    return withOverlap;
  }
  return chunks;
}

function splitLongParagraph(
  para: string,
  targetSize: number,
  overlap: number
): string[] {
  const sentences = para.match(/[^.!?]+[.!?]+["')]?\s*|\S[^.!?]*$/g) ?? [para];
  const parts: string[] = [];
  let current = "";

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current.length === 0) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= targetSize) {
      current += " " + sentence;
    } else {
      parts.push(current);
      current = sentence;
    }
    // Aşırı uzun tekil cümleler için sert bölme.
    while (current.length > targetSize * 1.5) {
      parts.push(current.slice(0, targetSize));
      current = current.slice(Math.max(0, targetSize - overlap));
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
