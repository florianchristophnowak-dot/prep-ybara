/* ============================================================
   Kleiner Markdown-Leser fuer das eingebaute Kurzhandbuch.

   HELP.md ist Teil der App und kein frei eingegebener Inhalt. Trotzdem
   entsteht hier bewusst kein HTML-String: Der Renderer bekommt eine
   einfache Datenstruktur und baut daraus normale React-Elemente. Damit
   bleiben Ueberschriften, Listen und Hervorhebungen lesbar, ohne dass
   Markdown-Zeichen oder ungeprueftes HTML in der Hilfe auftauchen.
   ============================================================ */

export function parseHelpInline(value) {
  const source = String(value || '');
  const tokens = [];
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', text: source.slice(cursor, match.index) });
    }

    const marked = match[0];
    if (marked.startsWith('**')) {
      tokens.push({ type: 'strong', text: marked.slice(2, -2) });
    } else if (marked.startsWith('`')) {
      tokens.push({ type: 'code', text: marked.slice(1, -1) });
    } else {
      tokens.push({ type: 'em', text: marked.slice(1, -1) });
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < source.length) {
    tokens.push({ type: 'text', text: source.slice(cursor) });
  }
  return tokens;
}

function plainHelpText(value) {
  return String(value || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function helpSlug(value) {
  return plainHelpText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'abschnitt';
}

export function parseHelpMarkdown(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const document = { title: 'Hilfe', blocks: [], toc: [] };
  const usedIds = new Map();
  let paragraph = [];
  let activeList = null;

  const pushParagraph = () => {
    if (!paragraph.length) return;
    document.blocks.push({
      type: 'paragraph',
      tokens: parseHelpInline(paragraph.join(' ')),
    });
    paragraph = [];
  };

  const pushList = () => {
    if (!activeList) return;
    document.blocks.push(activeList);
    activeList = null;
  };

  const uniqueId = (heading) => {
    const base = helpSlug(heading);
    const count = (usedIds.get(base) || 0) + 1;
    usedIds.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      pushParagraph();
      pushList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      pushParagraph();
      pushList();
      const level = headingMatch[1].length;
      const text = plainHelpText(headingMatch[2]);

      if (level === 1 && document.title === 'Hilfe' && document.blocks.length === 0) {
        document.title = text;
        continue;
      }

      const id = uniqueId(text);
      document.blocks.push({ type: 'heading', level, text, id });
      if (level === 2) document.toc.push({ id, text });
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      pushParagraph();
      pushList();
      document.blocks.push({ type: 'rule' });
      continue;
    }

    const orderedMatch = /^(\s*)(\d+)[.)]\s+(.+)$/.exec(rawLine);
    const bulletMatch = /^(\s*)[-*]\s+(.+)$/.exec(rawLine);
    const listMatch = orderedMatch || bulletMatch;
    if (listMatch) {
      pushParagraph();
      const ordered = Boolean(orderedMatch);
      const indent = (listMatch[1] || '').replace(/\t/g, '    ').length;
      const level = Math.min(3, Math.floor(indent / 2));
      const itemText = ordered ? orderedMatch[3] : bulletMatch[2];
      const start = ordered ? Number(orderedMatch[2]) || 1 : undefined;

      if (!activeList || activeList.ordered !== ordered || activeList.level !== level) {
        pushList();
        activeList = { type: 'list', ordered, level, start, items: [] };
      }
      activeList.items.push(parseHelpInline(itemText));
      continue;
    }

    /* Eingerueckte Folgezeilen gehoeren zum vorherigen Listenpunkt. Das
       Kurzhandbuch nutzt sie, wenn ein langer Schritt im Markdown auf
       zwei Quellzeilen verteilt ist. Ohne diese Behandlung wuerde daraus
       mitten in einer nummerierten Anleitung ein eigener Absatz. */
    if (activeList && /^\s+/.test(rawLine) && activeList.items.length) {
      const lastItem = activeList.items[activeList.items.length - 1];
      lastItem.push({ type: 'text', text: ' ' }, ...parseHelpInline(trimmed));
      continue;
    }

    pushList();
    paragraph.push(trimmed);
  }

  pushParagraph();
  pushList();
  return document;
}
