/* ============================================================
   Aufbereitung des Word-Exports – gemeinsam für beide Plattformen.

   Wichtig: Der Word-Export erzeugt KEIN .docx, sondern für Word
   aufbereitetes HTML mit der Endung .doc. Word öffnet das auf allen
   Versionen zuverlässig; ein konvertiertes .docx machte auf manchen
   Systemen Probleme.

   Dieses Modul liegt bewusst hier und nicht doppelt in Haupt- und
   Renderer-Prozess: Ausgedruckte Stundenplanungen landen in Ordnern und
   Prüfungsakten, das Layout muss stabil bleiben. Zwei Kopien derselben
   Logik würden früher oder später auseinanderlaufen.

   Der Hauptprozess lädt es per dynamischem import(), der Renderer bindet
   es über den Bündler ein.
   ============================================================ */

/** Erkennt das Querformat am Meta-Tag, das die Export-Bauer setzen. */
export function isLandscapeHtml(html){
  return /name=["']page-orientation["']\s+content=["']landscape["']/.test(String(html || ''));
}

/** Bringt ein Fragment in ein vollständiges HTML-Dokument. */
export function buildFullHtmlDocument(html){
  const src = String(html || '');
  const headMatch = src.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleTags = src.match(/<style[^>]*>[\s\S]*?<\/style>/ig) || [];

  const headInner = headMatch ? headMatch[1] : '';
  const bodyInner = bodyMatch ? bodyMatch[1] : src;

  return `<!doctype html><html><head><meta charset="utf-8" />\n${headInner}\n${styleTags.join('\n')}\n</head><body>${bodyInner}</body></html>`;
}

/** Ergänzt die mso-/@page-Hinweise, damit der Ausdruck aus Word passt. */
export function wrapHtmlForWord(fullHtml, { landscape } = {}){
  const html = String(fullHtml || '');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headInner = headMatch ? headMatch[1] : '';
  const bodyInner = bodyMatch ? bodyMatch[1] : html;

  // A4 in pt (Word versteht pt zuverlässig):
  // portrait: 595.28pt × 841.89pt, landscape: swap.
  const w = landscape ? 841.89 : 595.28;
  const h = landscape ? 595.28 : 841.89;

  const wordPageCss = `
    <style>
      @page Section1 { size: ${w.toFixed(2)}pt ${h.toFixed(2)}pt; margin: 12mm; mso-page-orientation: ${landscape ? 'landscape' : 'portrait'}; }
      div.Section1 { page: Section1; }
    </style>
  `;

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  ${headInner}
  ${wordPageCss}
</head>
<body>
  <div class="Section1">
    ${bodyInner}
  </div>
</body>
</html>`;
}

/** Der vollständige Weg vom Export-Fragment zur fertigen .doc-Datei. */
export function buildWordDocument(html){
  return wrapHtmlForWord(buildFullHtmlDocument(html), { landscape: isLandscapeHtml(html) });
}
