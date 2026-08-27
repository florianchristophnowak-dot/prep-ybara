import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseHelpInline, parseHelpMarkdown } from '../renderer/src/help-markdown.js';

test('Markdown-Auszeichnungen werden in darstellbare Textbausteine zerlegt', ()=>{
  assert.deepEqual(parseHelpInline('Ein **wichtiger** Schritt mit *Hinweis* und `Datei`.'), [
    { type: 'text', text: 'Ein ' },
    { type: 'strong', text: 'wichtiger' },
    { type: 'text', text: ' Schritt mit ' },
    { type: 'em', text: 'Hinweis' },
    { type: 'text', text: ' und ' },
    { type: 'code', text: 'Datei' },
    { type: 'text', text: '.' },
  ]);
});

test('Das Kurzhandbuch wird als Ueberschriften, Absaetze und Listen gelesen', async ()=>{
  const markdown = await readFile(new URL('../renderer/src/assets/HELP.md', import.meta.url), 'utf8');
  const dokument = parseHelpMarkdown(markdown);

  assert.equal(dokument.title, 'Prép-ybara – Hilfe');
  assert.ok(dokument.toc.length >= 9);
  assert.equal(dokument.toc[0].text, '1) Wochenplan');
  assert.ok(dokument.blocks.some(block => block.type === 'heading' && block.level === 3));
  assert.ok(dokument.blocks.some(block => block.type === 'list' && block.ordered));
  assert.ok(dokument.blocks.some(block => block.type === 'list' && !block.ordered));

  const sichtbarerText = dokument.blocks
    .flatMap(block => block.tokens || block.items?.flat() || [])
    .map(token => token.text)
    .join(' ');
  assert.ok(sichtbarerText.includes('direkt aufeinanderfolgende'));
  assert.ok(!sichtbarerText.includes('**direkt aufeinanderfolgende**'));
});

test('Gleichlautende Ueberschriften erhalten eindeutige Sprungziele', ()=>{
  const dokument = parseHelpMarkdown('# Hilfe\n\n## Abschnitt\n\nText\n\n## Abschnitt');
  assert.deepEqual(dokument.toc.map(eintrag => eintrag.id), ['abschnitt', 'abschnitt-2']);
});

test('Fortsetzungszeilen bleiben Teil eines nummerierten Schritts', ()=>{
  const dokument = parseHelpMarkdown('1. Erster Schritt\n   mit weiterer Erklaerung\n2. Zweiter Schritt');
  const liste = dokument.blocks.find(block => block.type === 'list');
  assert.equal(liste.items.length, 2);
  assert.equal(liste.items[0].map(token => token.text).join(''), 'Erster Schritt mit weiterer Erklaerung');
});
