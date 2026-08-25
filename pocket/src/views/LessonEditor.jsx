/* ============================================================
   Mobile Einzelstundenplanung

   Die Standardansicht zeigt sieben Bereiche und sonst nichts:

       Lerngruppe/Datum · Thema · Lernziele · Kompetenzen ·
       Kommunikative Aufgabe · Phasen · Notizen

   Alles Weitere – Erfolgskriterien, Sprechabsichten, Wortschatz,
   Grammatik, Aussprache, weitere Mittel – liegt hinter Griffen, die
   anzeigen, ob dahinter etwas steht. Wer sie nie öffnet, merkt von
   ihnen nichts; wer sie braucht, findet sie an einer Stelle.

   Das ist der Unterschied zur Desktop-App und der Grund, warum Pocket
   keine verkleinerte Fassung davon ist: Am PC schadet ein Feld, das man
   nicht braucht, kaum. Auf einem Telefon kostet jedes sichtbare Feld
   eine Bildschirmhöhe – und die Stunde ist in fünf Minuten Pause zu
   erfassen oder gar nicht.

   Gespeichert wird laufend. Es gibt keinen Speichern-Knopf und keine
   Rückfrage beim Verlassen.
   ============================================================ */

import { Flaeche, Eingabe, Feld, Klapp, Knopf, Kopf, SymbolKnopf, ZurueckKnopf } from '../ui.jsx';
import Zuordnung from './Zuordnung.jsx';
import EtikettWahl from './EtikettWahl.jsx';
import PhaseListe from './PhaseListe.jsx';
import { entwurfTitel } from '../model.js';
import { formatDatum } from '../../../shared/datum.js';

function ListenFeld({ name, werte = [], onWerte, platzhalter, knopf = '+ Eintrag' }){
  const setzen = (index, wert)=> onWerte(werte.map((w, i) => i === index ? wert : w));
  return (
    <div className="abschnitt" style={{ gap: 8 }}>
      {name ? <span className="feldName">{name}</span> : null}
      {(werte.length ? werte : ['']).map((wert, index)=>(
        <div key={index} className="reihe" style={{ alignItems: 'flex-start' }}>
          <div className="wachs">
            <Flaeche wert={wert} onWert={(v)=>setzen(index, v)} placeholder={platzhalter} minZeilen={1} />
          </div>
          {werte.length > 1 ? (
            <SymbolKnopf
              zeichen="🗑"
              beschriftung={`${name || 'Eintrag'} löschen`}
              onClick={()=>onWerte(werte.filter((_, i) => i !== index))}
            />
          ) : null}
        </div>
      ))}
      <Knopf klein onClick={()=>onWerte([...(werte.length ? werte : ['']), ''])}>{knopf}</Knopf>
    </div>
  );
}

export default function LessonEditor({
  entwurf, profil, einstellungen, onAendern, onZurueck, onExport, onMehr, onEigenesEtikett,
}){
  const sprachModus = Boolean(profil?.languageMode);
  const eigeneKompetenzen = einstellungen?.eigeneKompetenzen || [];
  const eigeneSprechabsichten = einstellungen?.eigeneSprechabsichten || [];

  const aufgabe = entwurf.communicativeTask || {};
  const mittel = entwurf.languageResources || {};
  const setzeAufgabe = (patch)=> onAendern({ communicativeTask: { ...aufgabe, ...patch } });
  const setzeMittel = (patch)=> onAendern({ languageResources: { ...mittel, ...patch } });

  const aufgabenDetails = [aufgabe.situation, aufgabe.audience, aufgabe.intention, aufgabe.outcome]
    .filter(Boolean).length;
  const mittelZahl = [mittel.vocabulary, mittel.grammar, mittel.pronunciation, mittel.other]
    .filter(Boolean).length;

  return (
    <>
      <Kopf
        titel={entwurfTitel(entwurf)}
        unter={[
          [entwurf.className, entwurf.subjectName].filter(Boolean).join(' '),
          entwurf.date ? formatDatum(entwurf.date) : '',
          entwurf.lessonNumber ? `${entwurf.lessonNumber}. Stunde` : '',
        ].filter(Boolean).join(' · ')}
        links={<ZurueckKnopf onClick={onZurueck} />}
        rechts={<SymbolKnopf zeichen="⋯" beschriftung="Weitere Aktionen" onClick={onMehr} />}
      />

      <main className="inhalt">
        <Zuordnung entwurf={entwurf} profil={profil} onAendern={onAendern} />

        <Feld name="Thema">
          <Eingabe
            wert={entwurf.topic}
            onWert={(v)=>onAendern({ topic: v })}
            placeholder="z. B. Les loisirs à Montréal"
            enterKeyHint="next"
          />
        </Feld>

        <ListenFeld
          name="Lernziel(e)"
          werte={entwurf.learningGoals || ['']}
          onWerte={(v)=>onAendern({ learningGoals: v })}
          platzhalter="Die Lernenden können …"
          knopf="+ Lernziel"
        />

        <div className="abschnitt">
          <span className="feldName">Kompetenzen</span>
          <EtikettWahl
            katalog={profil?.competencies || []}
            eigene={eigeneKompetenzen}
            gewaehlt={entwurf.competencies || []}
            onGewaehlt={(v)=>onAendern({ competencies: v })}
            onEigeneHinzu={(label)=>onEigenesEtikett?.('kompetenz', label)}
            gruppiert={sprachModus}
            neuBeschriftung="+ Eigene Kompetenz"
            neuTitel="Eigene Kompetenz"
            platzhalter="z. B. Gesprächsstrategien"
            primaer={entwurf.primaryCompetency}
            onPrimaer={(v)=>onAendern({ primaryCompetency: v })}
          />
        </div>

        <div className="abschnitt">
          <span className="feldName">Kommunikative Aufgabe</span>
          <Flaeche
            wert={aufgabe.text || ''}
            onWert={(v)=>setzeAufgabe({ text: v })}
            placeholder="Was tun die Lernenden mit der Sprache?"
            minZeilen={2}
          />
          <Klapp titel="Situation, Adressat, Absicht, Ergebnis" zahl={aufgabenDetails}>
            <Feld name="Situation">
              <Flaeche wert={aufgabe.situation || ''} onWert={(v)=>setzeAufgabe({ situation: v })} minZeilen={1} />
            </Feld>
            <Feld name="Adressat">
              <Flaeche wert={aufgabe.audience || ''} onWert={(v)=>setzeAufgabe({ audience: v })} minZeilen={1} />
            </Feld>
            <Feld name="Kommunikative Absicht">
              <Flaeche wert={aufgabe.intention || ''} onWert={(v)=>setzeAufgabe({ intention: v })} minZeilen={1} />
            </Feld>
            <Feld name="Ergebnis / Produkt">
              <Flaeche wert={aufgabe.outcome || ''} onWert={(v)=>setzeAufgabe({ outcome: v })} minZeilen={1} />
            </Feld>
          </Klapp>
        </div>

        <div className="abschnitt">
          <span className="feldName">Phasen</span>
          <PhaseListe
            phasen={entwurf.phases || []}
            onPhasen={(v)=>onAendern({ phases: v })}
            phasenTypen={profil?.phaseTypes || []}
            sozialformen={profil?.socialForms || []}
            hilfenVorschlaege={(profil?.scaffoldTemplates || []).map(s => s.label)}
            zeigeHilfen={sprachModus}
          />
        </div>

        <Feld name="Notizen">
          <Flaeche
            wert={entwurf.notes}
            onWert={(v)=>onAendern({ notes: v })}
            placeholder="Was sonst noch wichtig ist"
            minZeilen={2}
          />
        </Feld>

        {/* ---- Alles Weitere, aufklappbar ---- */}

        <Klapp titel="Erfolgskriterien" zahl={(entwurf.successCriteria || []).filter(Boolean).length}>
          <ListenFeld
            werte={entwurf.successCriteria || ['']}
            onWerte={(v)=>onAendern({ successCriteria: v })}
            platzhalter="Woran erkenne ich, dass das Ziel erreicht ist?"
            knopf="+ Kriterium"
          />
        </Klapp>

        <Klapp titel="Sprechabsichten" zahl={(entwurf.speechActs || []).length}>
          <EtikettWahl
            katalog={profil?.speechActs || []}
            eigene={eigeneSprechabsichten}
            gewaehlt={entwurf.speechActs || []}
            onGewaehlt={(v)=>onAendern({ speechActs: v })}
            onEigeneHinzu={(label)=>onEigenesEtikett?.('sprechabsicht', label)}
            neuBeschriftung="+ Eigene Sprechabsicht"
            neuTitel="Eigene Sprechabsicht"
            platzhalter="z. B. Vorschläge machen"
          />
        </Klapp>

        <Klapp titel="Sprachliche Mittel" zahl={mittelZahl}>
          <Feld name="Wortschatz">
            <Flaeche wert={mittel.vocabulary || ''} onWert={(v)=>setzeMittel({ vocabulary: v })} minZeilen={1} />
          </Feld>
          <Feld name="Grammatik / Strukturen">
            <Flaeche wert={mittel.grammar || ''} onWert={(v)=>setzeMittel({ grammar: v })} minZeilen={1} />
          </Feld>
          <Feld name="Aussprache / Phonologie">
            <Flaeche wert={mittel.pronunciation || ''} onWert={(v)=>setzeMittel({ pronunciation: v })} minZeilen={1} />
          </Feld>
          <Feld name="Weitere sprachliche Mittel">
            <Flaeche wert={mittel.other || ''} onWert={(v)=>setzeMittel({ other: v })} minZeilen={1} />
          </Feld>
        </Klapp>

        <div className="aktionsLeiste">
          <Knopf breit art="primaer" onClick={onExport}>Für Prép-ybara exportieren</Knopf>
        </div>
      </main>
    </>
  );
}
