/* ============================================================
   Startseite

   Sie beantwortet eine Frage: "Was plane ich jetzt?"

   Mit eingelesenem Profil steht oben, was heute (oder als Nächstes)
   ansteht – aus dem Stundenplan, ohne dass jemand etwas auswählen
   müsste. Ein Fingertipp führt in die Planung, mit bereits gesetzter
   Lerngruppe, Datum und Stunde. Das ist der Kern des kurzen
   Arbeitswegs: Pocket öffnen → 9b Französisch → Thema → Lernziel →
   Phasen → fertig.

   Darunter die letzten Entwürfe, damit man dort weitermacht, wo man
   aufgehört hat.

   Ohne Profil bleibt die Seite dieselbe, nur ohne den oberen Teil – und
   mit einem Hinweis, dass es ein Profil gibt. Pocket ist ohne Profil
   vollständig benutzbar.
   ============================================================ */

import { useMemo } from 'react';
import { Knopf, Kopf, LeerBild, Hinweis } from '../ui.jsx';
import { entwurfTitel, gruppenBeschriftung } from '../model.js';
import { formatDatum, relativeZeit, toISODate } from '../../../shared/datum.js';

/* Die Termine, die jetzt zählen: heute – und wenn heute nichts mehr
   ansteht, der nächste Tag mit Unterricht. Weiter voraus zu blicken
   wäre auf der Startseite Lärm; dafür gibt es "Neue Stunde". */
export function anstehendeTermine(profil, heuteISO){
  const plan = profil?.timetable || [];
  if (!plan.length) return { datum: '', termine: [] };
  const heute = plan.filter(e => e.date === heuteISO);
  if (heute.length) return { datum: heuteISO, termine: heute };
  const kuenftig = plan.filter(e => e.date > heuteISO).sort((a, b) => a.date.localeCompare(b.date));
  if (!kuenftig.length) return { datum: '', termine: [] };
  const naechsterTag = kuenftig[0].date;
  return { datum: naechsterTag, termine: kuenftig.filter(e => e.date === naechsterTag) };
}

export default function HomeView({
  profil, entwuerfe, onNeueStunde, onSchnellplanung, onNeueIdee, onOeffnen, onTerminPlanen,
  onAlleEntwuerfe, onEinstellungen, heuteISO = toISODate(new Date()),
}){
  const { datum, termine } = useMemo(()=> anstehendeTermine(profil, heuteISO), [profil, heuteISO]);
  const istHeute = datum === heuteISO;

  /* Zu einem Termin kann schon ein Entwurf gehören. Dann wird er
     angeboten statt eines zweiten, leeren. */
  const entwurfZuTermin = (termin)=> entwuerfe.find(e =>
    e.date === termin.date
    && Number(e.lessonNumber) === Number(termin.lessonNumber)
    && (e.groupId ? e.groupId === termin.groupId : gruppenBeschriftung(e) === gruppenBeschriftung(termin))
  );

  const letzte = entwuerfe.slice(0, 4);

  return (
    <>
      <Kopf titel="Prép-ybara Pocket" unter="Erfassen – organisiert wird am PC" />

      <main className="inhalt">
        {termine.length ? (
          <section className="abschnitt">
            <h2 className="abschnittTitel">{istHeute ? 'Heute' : formatDatum(datum, { lang: true })}</h2>
            {termine.map((termin)=>{
              const vorhanden = entwurfZuTermin(termin);
              return (
                <div key={`${termin.date}-${termin.lessonNumber}-${termin.groupId}`} className="karte karte--flach">
                  <div className="reihe">
                    <span className="wachs">
                      <span className="karteTitel">{[termin.className, termin.subjectName].filter(Boolean).join(' ')}</span>
                      <span className="leise klein" style={{ display: 'block' }}>
                        {termin.lessonNumber}. Stunde
                        {termin.startTime ? ` · ${termin.startTime}` : ''}
                        {termin.planned ? ' · am PC bereits geplant' : ''}
                      </span>
                    </span>
                  </div>
                  <Knopf
                    breit
                    art={vorhanden ? '' : 'primaer'}
                    onClick={()=> vorhanden ? onOeffnen(vorhanden) : onTerminPlanen(termin)}
                  >{vorhanden ? 'Entwurf öffnen' : 'Stunde planen'}</Knopf>
                </div>
              );
            })}
          </section>
        ) : null}

        {!profil ? (
          <Hinweis>
            Kein Profil eingelesen. Pocket funktioniert auch so – Lerngruppe und Fach
            werden dann frei eingetragen.{' '}
            <button type="button" className="knopf knopf--leise knopf--klein" onClick={onEinstellungen}>
              Profil importieren
            </button>
          </Hinweis>
        ) : null}

        <section className="abschnitt">
          <h2 className="abschnittTitel">Entwürfe</h2>
          {letzte.length ? letzte.map(entwurf => (
            <button key={entwurf.id} type="button" className="karteKnopf" onClick={()=>onOeffnen(entwurf)}>
              <span className="karteTitel">{entwurfTitel(entwurf)}</span>
              <span className="leise klein">
                {[gruppenBeschriftung(entwurf), relativeZeit(entwurf.updatedAt)].filter(Boolean).join(' · ')}
              </span>
            </button>
          )) : (
            <LeerBild
              zeichen="✏️"
              titel="Noch nichts erfasst"
              text="Eine neue Stunde ist in ein paar Minuten geplant."
            />
          )}
          {entwuerfe.length > letzte.length ? (
            <Knopf breit onClick={onAlleEntwuerfe}>Alle {entwuerfe.length} Entwürfe</Knopf>
          ) : null}
        </section>

        <section className="abschnitt">
          <Knopf breit art="primaer" onClick={onNeueStunde}>+ Neue Stunde</Knopf>
          <Knopf breit onClick={onSchnellplanung}>⚡ Schnellplanung</Knopf>
          <Knopf breit onClick={onNeueIdee}>+ Unterrichtsidee</Knopf>
        </section>
      </main>
    </>
  );
}
