/**
 * pdf-parse paketinin resmi tip tanımı yoktur.
 * Doğrudan `pdf-parse/lib/pdf-parse.js` alt modülünü kullanıyoruz; paketin
 * index.js dosyası Node altında debug moduna düşebildiği için bu daha güvenlidir.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;

  export = pdfParse;
}
