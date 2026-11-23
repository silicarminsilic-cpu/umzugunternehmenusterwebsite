<?php
/**
 * Lead-Endpunkt (Referenzimplementierung, PHP 8+)
 * - Serverseitige Validierung, Honeypot, Zeitprüfung, einfaches Rate-Limit
 * - Speichert Leads als JSON-Zeile (JSONL) AUSSERHALB des Web-Roots
 * - Optionaler Webhook-Versand an ein CRM (Schlüssel nur serverseitig)
 * Konfiguration: api/config.php (siehe config.example.php). Nie ins Frontend legen.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$dataDir = $cfg['data_dir'] ?? dirname(__DIR__, 2) . '/uu-data';   // ausserhalb Web-Root!
$webhook = $cfg['webhook_url'] ?? '';
$secret  = $cfg['webhook_secret'] ?? '';
$origin  = $cfg['allowed_origin'] ?? '';

function out(int $code, array $d): never { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
if ($origin && ($_SERVER['HTTP_ORIGIN'] ?? '') !== '' && $_SERVER['HTTP_ORIGIN'] !== $origin) out(403, ['ok' => false, 'message' => 'origin']);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['ok' => false, 'message' => 'method']);

$raw = file_get_contents('php://input', false, null, 0, 65536);
$in = json_decode($raw ?: '', true);
if (!is_array($in)) out(400, ['ok' => false, 'message' => 'json']);

// Honeypot / Zeitprüfung: Bots bekommen stillschweigend "ok"
if (!empty($in['meta']['website'])) out(200, ['ok' => true, 'leadId' => 'UU-' . date('ymd') . '-XXXXX']);

// Zu schnelle Übermittlung (< 2.5 s auf dem letzten Schritt) = vermutlich Bot: stillschweigend ok
if (isset($in['meta']['elapsedMs']) && (int)$in['meta']['elapsedMs'] > 0 && (int)$in['meta']['elapsedMs'] < 2500 && ($in['type'] ?? '') === 'lead') out(200, ['ok' => true, 'leadId' => 'UU-' . date('ymd') . '-XXXXX']);

if (!is_dir($dataDir)) @mkdir($dataDir, 0750, true);

// Rate-Limit: max. 8 Anfragen pro IP und Stunde
$ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . ($cfg['ip_salt'] ?? 'change-me'));
$rl = "$dataDir/rl_" . substr($ip, 0, 16) . '.json';
$hits = is_file($rl) ? (json_decode((string)file_get_contents($rl), true) ?: []) : [];
$hits = array_values(array_filter($hits, fn($t) => $t > time() - 3600));
if (count($hits) >= 8) out(429, ['ok' => false, 'message' => 'rate']);
$hits[] = time(); file_put_contents($rl, json_encode($hits), LOCK_EX);

// Idempotenz: gleicher Key liefert gleiche Lead-ID
$key = preg_replace('/[^A-Za-z0-9\-]/', '', (string)($in['idempotencyKey'] ?? ''));
if ($key === '') out(400, ['ok' => false, 'message' => 'key']);
$idxFile = "$dataDir/idempotency.json";
$idx = is_file($idxFile) ? (json_decode((string)file_get_contents($idxFile), true) ?: []) : [];
if (isset($idx[$key])) out(200, ['ok' => true, 'leadId' => $idx[$key]]);

$type = $in['type'] ?? '';
$errors = [];
$phone = (string)($in['contact']['phone'] ?? '');
if (!preg_match('/^\+41[1-9]\d{8}$/', $phone)) $errors['phone'] = 'invalid';
if (empty($in['consent']['given'])) $errors['consent'] = 'required';
if ($type === 'lead') {
    $c = $in['contact'] ?? [];
    if (mb_strlen(trim((string)($c['firstName'] ?? ''))) < 2) $errors['firstName'] = 'invalid';
    if (mb_strlen(trim((string)($c['lastName'] ?? ''))) < 2) $errors['lastName'] = 'invalid';
    if (!filter_var($c['email'] ?? '', FILTER_VALIDATE_EMAIL)) $errors['email'] = 'invalid';
    foreach (['from', 'to'] as $k) {
        if (!preg_match('/^[1-9]\d{3}$/', (string)($in[$k]['plz'] ?? ''))) $errors[$k . 'Plz'] = 'invalid';
        if (mb_strlen(trim((string)($in[$k]['ort'] ?? ''))) < 2) $errors[$k . 'Ort'] = 'invalid';
    }
    $itemsFlow = in_array($in['situationCode'] ?? '', ['einzel', 'sonst'], true);
    if (!$itemsFlow && empty($in['household'])) $errors['household'] = 'required';
    if ($itemsFlow && mb_strlen(trim((string)($in['items'] ?? ''))) < 5) $errors['items'] = 'required';
} elseif ($type !== 'callback') {
    out(400, ['ok' => false, 'message' => 'type']);
}
if ($errors) out(422, ['ok' => false, 'message' => 'validation', 'fields' => $errors]);

$prefix = $type === 'callback' ? 'RC' : 'UU';
$leadId = $prefix . '-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 5));
$record = $in + ['leadId' => $leadId, 'receivedAt' => date('c'), 'status' => 'Neue Anfrage'];
unset($record['meta']['website']);
// Score serverseitig plausibilisieren (Client-Wert wird nie blind uebernommen)
$tier = $record['leadTier'] ?? 'C'; if (!in_array($tier, ['A','B','C'], true)) $tier = 'C';
$record['leadScore'] = max(0, min(100, (int)($record['leadScore'] ?? 0))); $record['leadTier'] = $tier;
$record['consent']['ipHash'] = $ip;   // Nachweis ohne Klartext-IP

if (file_put_contents("$dataDir/leads.jsonl", json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) === false)
    out(500, ['ok' => false, 'message' => 'storage']);
$idx[$key] = $leadId; file_put_contents($idxFile, json_encode($idx), LOCK_EX);

// Optional: Weiterleitung an CRM/Webhook (Fehler blockieren die Bestätigung nicht, Lead ist gespeichert)
if ($webhook) {
    $body = json_encode($record, JSON_UNESCAPED_UNICODE);
    $ch = curl_init($webhook);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Signature: ' . hash_hmac('sha256', $body, $secret)]]);
    curl_exec($ch); curl_close($ch);
}
// Benachrichtigung an das Team (schnelle Reaktion ist der wichtigste Hebel) und Bestaetigung an die Anfragenden
$notify = $cfg['notify_email'] ?? ''; $from = $cfg['mail_from'] ?? '';
if ($notify && $from) {
    $c = $record['contact'] ?? [];
    @mail($notify, "[$tier] Neue Umzugsanfrage $leadId", "Prioritaet $tier (Score {$record['leadScore']})\nNr. $leadId\nName: " . ($c['firstName'] ?? '') . ' ' . ($c['lastName'] ?? $c['name'] ?? '') . "\nTelefon: " . ($c['phone'] ?? '') . "\nE-Mail: " . ($c['email'] ?? '') . "\n\nDetails im Lead-Speicher.", "From: $from\r\nContent-Type: text/plain; charset=UTF-8");
    $to = $c['email'] ?? '';
    if ($to && filter_var($to, FILTER_VALIDATE_EMAIL)) {
        @mail($to, 'Ihre Umzugsanfrage ist eingegangen', "Guten Tag\n\nvielen Dank, wir haben Ihre Anfrage ($leadId) erhalten und melden uns bei Ihnen. Die Anfrage ist unverbindlich.\n\nFreundliche Gruesse\nUmzug Uster", "From: $from\r\nContent-Type: text/plain; charset=UTF-8");
    }
}
out(200, ['ok' => true, 'leadId' => $leadId]);
