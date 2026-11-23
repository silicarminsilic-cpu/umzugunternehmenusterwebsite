/* ==========================================================
   Konfiguration – hier werden vor dem Go-live die echten Werte
   hinterlegt. Es gehören KEINE geheimen Schlüssel hierher
   (alles in dieser Datei ist öffentlich sichtbar).
   ========================================================== */
window.UU_CONFIG = {
  // Backend-Endpunkt für Anfragen (POST, JSON). Leer = Vorschau
  // (Erfolgsseite wird nur simuliert, es werden keine Daten gespeichert).
  // Beispiel: '/api/lead.php'
  endpoint: '',

  // Formular-Dienst Web3Forms (für Hosting ohne PHP, z. B. GitHub Pages).
  // Den öffentlichen Access Key von web3forms.com hier eintragen. Er ist
  // an die Empfänger-E-Mail gebunden und darf öffentlich sichtbar sein.
  web3formsKey: 'HIER-ACCESS-KEY-EINTRAGEN',

  // Google Tag Manager Container, z. B. 'GTM-XXXXXXX'. Leer = kein Tracking.
  // Wird erst nach Zustimmung im Consent-Banner geladen.
  gtmId: '',

  // Kontaktkanäle: werden nur angezeigt, wenn tatsächlich eingerichtet.
  phone: { display: '044 222 00 09', tel: '+41442220009' },
  whatsapp: '',                            // Nummer ohne +, z. B. '41791234567'
  email: 'anfrage@umzug-unternehmen-uster.ch',

  // Version des Einwilligungstexts (wird mit jeder Anfrage protokolliert).
  consentVersion: '2026-11-v3-tanner',

  // Nur wenn hier tatsächlich Partnerdaten hinterlegt sind, zeigt die
  // Regionenprüfung "Partner verfügbar" an. Beispiel: ['8610', '8620', 'Uster']
  confirmedPartnerRegions: []
};
