<?php
// Kopieren nach api/config.php und ausfüllen. Diese Datei NIE ins Frontend/Git mit echten Werten.
return [
  'data_dir'       => '/pfad/ausserhalb/webroot/uu-data',
  'webhook_url'    => '',            // z. B. CRM-/Make-/Zapier-Webhook
  'webhook_secret' => '',            // für HMAC-Signatur (Header X-Signature)
  'allowed_origin' => 'https://www.umzug-unternehmen-uster.ch',
  'notify_email'   => '',            // Teamadresse fuer sofortige Benachrichtigung
  'mail_from'      => '',            // Absender, z. B. anfrage@umzug-unternehmen-uster.ch
  'ip_salt'        => 'zufaelligen-langen-string-setzen',
];
