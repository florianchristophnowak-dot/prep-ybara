/* ============================================================
   Einstellungen

   Vier Dinge, mehr braucht Pocket nicht: das Profil, die Ablage, die
   Installation und die Auskunft, was diese App tut und was nicht.

   Der Satz zum Datenschutz steht hier ohne Einschränkung, weil er ohne
   Einschränkung gilt: kein Konto, keine Cloud, keine KI, keine
   Zählpixel, keine Anfrage nach aussen. Alles, was Pocket zur Laufzeit
   braucht, ist mitgeliefert.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Bestaetigung, Hinweis, Knopf, Kopf } from '../ui.jsx';
import { POCKET_VERSION } from '../version.js';
import { EXCHANGE_SCHEMA_VERSION, EXT_PROFILE, profilUmfang } from '../../../shared/exchange/index.js';
import { frageDauerhafteAblage } from '../db.js';
import { aufInstallierbarkeit, frageInstallation, istInstallierbar, laeuftInstalliert } from '../pwa.js';
import { zahlwort } from '../model.js';

export default function SettingsView({ profil, onProfilImportieren, onProfilEntfernen, entwurfsZahl }){
  const [ablage, setAblage] = useState(null);
  const [installierbar, setInstallierbar] = useState(istInstallierbar());
  const [entfernenFrage, setEntfernenFrage] = useState(false);

  useEffect(()=>{
    let abgebrochen = false;
    frageDauerhafteAblage().then((z)=>{ if (!abgebrochen) setAblage(z); });
    const abmelden = aufInstallierbarkeit(setInstallierbar);
    return ()=>{ abgebrochen = true; abmelden?.(); };
  }, []);

  const umfang = profil ? profilUmfang(profil) : null;

  return (
    <>
      <Kopf titel="Einstellungen" />

      <main className="inhalt">
        <section className="abschnitt">
          <h2 className="abschnittTitel">Prép-ybara-Profil</h2>
          {profil ? (
            <div className="karte">
              <div className="karteTitel">Profil eingelesen</div>
              <div className="leise klein">
                {zahlwort(umfang.groups, 'Lerngruppe', 'Lerngruppen')}
                {' · '}{zahlwort(umfang.subjects, 'Fach', 'Fächer')}
                {' · '}{zahlwort(umfang.competencies, 'Kompetenz', 'Kompetenzen')}
                {' · '}{zahlwort(umfang.speechActs, 'Sprechabsicht', 'Sprechabsichten')}
                {' · '}{zahlwort(umfang.timetable, 'Stundenplaneintrag', 'Stundenplaneinträge')}
              </div>
              {profil.languageMode ? (
                <div className="leise klein">Fremdsprachenmodus ist im Profil aktiv.</div>
              ) : null}
              <div className="leise klein">
                Stand: {new Date(profil.exportedAt).toLocaleString('de-DE')}
              </div>
              <Knopf breit onClick={onProfilImportieren}>Profil aktualisieren</Knopf>
              <Knopf breit art="gefahr" onClick={()=>setEntfernenFrage(true)}>Profil entfernen</Knopf>
            </div>
          ) : (
            <div className="karte">
              <p className="leise" style={{ margin: 0 }}>
                Noch kein Profil. Ohne Profil funktioniert Pocket vollständig – Lerngruppe
                und Fach werden dann frei eingetragen.
              </p>
              <Knopf breit art="primaer" onClick={onProfilImportieren}>Prép-ybara-Profil importieren</Knopf>
              <span className="leise klein">
                Die Datei entsteht in Prép-ybara am PC: Einstellungen → Prép-ybara Pocket →
                Pocket-Profil exportieren. Endung {EXT_PROFILE}.
              </span>
            </div>
          )}
          <Hinweis>
            Ein neues Profil ersetzt nur das Profil. Vorhandene Entwürfe
            {entwurfsZahl ? ` (${entwurfsZahl})` : ''} bleiben erhalten.
          </Hinweis>
        </section>

        <section className="abschnitt">
          <h2 className="abschnittTitel">Auf dem Gerät</h2>
          {laeuftInstalliert() ? (
            <Hinweis art="gut">Pocket läuft als installierte App und funktioniert ohne Netz.</Hinweis>
          ) : installierbar ? (
            <div className="karte">
              <p className="leise" style={{ margin: 0 }}>
                Pocket lässt sich zum Startbildschirm hinzufügen. Danach startet es wie eine
                App und funktioniert ohne Netz.
              </p>
              <Knopf breit art="primaer" onClick={frageInstallation}>Zum Startbildschirm hinzufügen</Knopf>
            </div>
          ) : (
            <Hinweis>
              Zum Startbildschirm hinzufügen: im Browsermenü „Zum Startbildschirm“ bzw.
              „App installieren“ wählen. Danach läuft Pocket auch ohne Netz.
            </Hinweis>
          )}

          {ablage?.unterstuetzt && !ablage.zugesagt ? (
            <Hinweis art="warnung">
              Der Browser hat die Ablage <b>nicht</b> als dauerhaft zugesagt. Bei Platzmangel
              oder beim Löschen der Browserdaten können Entwürfe verschwinden – exportiere
              wichtige Stunden zeitnah.
            </Hinweis>
          ) : null}
          {ablage?.zugesagt ? (
            <Hinweis art="gut">Die Ablage ist als dauerhaft zugesagt.</Hinweis>
          ) : null}
        </section>

        <section className="abschnitt">
          <h2 className="abschnittTitel">Was Pocket tut – und was nicht</h2>
          <div className="karte">
            <p className="leise" style={{ margin: 0 }}>
              Alle Entwürfe liegen in der Datenbank dieses Browsers, auf diesem Gerät.
              Es gibt keine Anmeldung, keine Cloud, keine KI, keine Statistik und keine
              Verbindung nach aussen. Schrift und Symbole sind mitgeliefert.
            </p>
            <p className="leise" style={{ margin: 0 }}>
              Der Austausch mit Prép-ybara läuft ausschliesslich über Dateien. Es gibt keine
              gemeinsame Datenbank zwischen Telefon und PC.
            </p>
          </div>
        </section>

        <section className="abschnitt">
          <h2 className="abschnittTitel">Version</h2>
          <p className="leise klein" style={{ margin: 0 }}>
            Prép-ybara Pocket {POCKET_VERSION} · Austauschschema {EXCHANGE_SCHEMA_VERSION} · © Florian Nowak
          </p>
          <p className="leise klein" style={{ margin: 0 }}>
            Pocket und die Desktop-App haben getrennte Versionsnummern. Verträglich sind sie,
            solange beide dasselbe Austauschschema lesen.
          </p>
        </section>
      </main>

      {entfernenFrage ? (
        <Bestaetigung
          frage="Profil entfernen?"
          text="Lerngruppen, Stundenplan und Kompetenzen aus Prép-ybara stehen dann nicht mehr zur Auswahl. Entwürfe bleiben unverändert erhalten."
          bestaetigen="Entfernen"
          gefahr
          onJa={()=>{ setEntfernenFrage(false); onProfilEntfernen(); }}
          onNein={()=>setEntfernenFrage(false)}
        />
      ) : null}
    </>
  );
}
