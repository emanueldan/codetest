<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

$realmMap = [
    'eu' => 'eu',
    'na' => 'com',
    'asia' => 'asia',
    'ru' => 'ru',
];

$realmParam = strtolower($_GET['realm'] ?? 'eu');
$realm = $realmMap[$realmParam] ?? $realmMap['eu'];
$realmKey = array_key_exists($realmParam, $realmMap) ? $realmParam : 'eu';
$clanId = preg_replace('/\D/', '', $_GET['clan_id'] ?? '') ?: '';
$appId = getenv('WOT_APP_ID') ?: '';
$selectedPlayerId = isset($_GET['player']) ? (int) $_GET['player'] : null;
$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$apiBase = sprintf('https://api.worldoftanks.%s', $realm);

$roleLabels = [
    'commander' => 'Commander',
    'executive_officer' => 'Executive Officer',
    'personnel_officer' => 'Personnel Officer',
    'combat_officer' => 'Combat Officer',
    'intelligence_officer' => 'Intelligence Officer',
    'quartermaster' => 'Quartermaster',
    'recruitment_officer' => 'Recruitment Officer',
    'junior_officer' => 'Junior Officer',
    'private' => 'Private',
    'reservist' => 'Reservist',
];

$roleColors = [
    'commander' => '#ff7a18',
    'executive_officer' => '#f472b6',
    'personnel_officer' => '#3b82f6',
    'combat_officer' => '#a855f7',
    'intelligence_officer' => '#10b981',
    'quartermaster' => '#f97316',
    'recruitment_officer' => '#22d3ee',
    'junior_officer' => '#8b5cf6',
    'private' => '#94a3b8',
    'reservist' => '#0ea5e9',
];

$clan = [
    'name' => 'Clan data unavailable',
    'tag' => '—',
    'motto' => '',
    'description' => '',
    'members_count' => 0,
    'leader' => 'Unknown',
    'created' => '—',
];
$roster = [];
$roleFilters = [];
$timelineMembers = [];
$averageWinRate = 0;
$totalBattles = 0;
$activeMembers = 0;
$performance = [];
$playerTanksByTier = [];
$tankLoadError = null;
$performanceLabels = ['Win rate %', 'Average XP', 'Survival %', 'Battles percentile', 'Victories percentile'];
$performanceColors = ['#34d399', '#f472b6', '#60a5fa', '#f97316', '#c084fc'];
$selectedPlayer = null;
$error = null;

function fetchApi(string $url, array $params): array
{
    $endpoint = $url . '?' . http_build_query($params);
    $handle = curl_init($endpoint);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $response = curl_exec($handle);
    if ($response === false) {
        $message = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException('Unable to reach World of Tanks API: ' . $message);
    }
    $statusCode = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if ($statusCode >= 400) {
        throw new RuntimeException('World of Tanks API returned HTTP ' . $statusCode);
    }

    $payload = json_decode($response, true);
    if (!is_array($payload)) {
        throw new RuntimeException('Unexpected API payload.');
    }

    return $payload;
}

try {
    $clanResponse = fetchApi($apiBase . '/wot/clans/info/', [
        'application_id' => $appId,
        'clan_id' => $clanId,
        'fields' => 'tag,name,clan_id,description,motto,members.account_id,members.role,members.joined_at,created_at,leader_name',
    ]);

    if (($clanResponse['status'] ?? 'error') !== 'ok') {
        throw new RuntimeException('Unable to load clan info: ' . ($clanResponse['error']['message'] ?? 'Unknown error'));
    }

    $clanData = $clanResponse['data'][$clanId] ?? null;
    if (!$clanData) {
        throw new RuntimeException('Clan not found.');
    }

    $clan = [
        'name' => $clanData['name'] ?? 'Unnamed clan',
        'tag' => $clanData['tag'] ?? '—',
        'description' => $clanData['description'] ?? '',
        'motto' => $clanData['motto'] ?? '',
        'leader' => $clanData['leader_name'] ?? 'Unknown',
        'created' => isset($clanData['created_at']) ? gmdate('Y-m-d', $clanData['created_at']) : '—',
        'members_count' => isset($clanData['members']) ? count($clanData['members']) : 0,
    ];

    $members = $clanData['members'] ?? [];
    if (!$members) {
        throw new RuntimeException('Clan has no members to display.');
    }

    $accountIds = array_column($members, 'account_id');
    $accountData = [];

    foreach (array_chunk($accountIds, 100) as $chunk) {
        $accountsResponse = fetchApi($apiBase . '/wot/account/info/', [
            'application_id' => $appId,
            'account_id' => implode(',', $chunk),
            'extra' => 'statistics.random',
            'fields' => 'account_id,nickname,global_rating,last_battle_time,statistics.random.battles,statistics.random.wins,statistics.random.losses,statistics.random.survived_battles,statistics.random.battle_avg_xp,statistics.random.damage_dealt',
        ]);

        if (($accountsResponse['status'] ?? 'error') !== 'ok') {
            throw new RuntimeException('Unable to load player info: ' . ($accountsResponse['error']['message'] ?? 'Unknown error'));
        }

        $accountData += $accountsResponse['data'];
    }

    foreach ($members as $member) {
        $accountId = $member['account_id'];
        if (!isset($accountData[$accountId])) {
            continue;
        }

        $account = $accountData[$accountId];
        $stats = $account['statistics']['random'] ?? [];
        $battles = (int) ($stats['battles'] ?? 0);
        $wins = (int) ($stats['wins'] ?? 0);
        $losses = (int) ($stats['losses'] ?? 0);
        $winRate = $battles > 0 ? $wins / $battles : 0;
        $survivalRate = $battles > 0 ? (int) ($stats['survived_battles'] ?? 0) / $battles : 0;
        $avgXp = (int) ($stats['battle_avg_xp'] ?? 0);
        $roleKey = $member['role'];
        $joinedAt = isset($member['joined_at']) ? (new DateTimeImmutable('@' . $member['joined_at'])) : null;
        $lastBattle = isset($account['last_battle_time']) ? (int) $account['last_battle_time'] : null;

        $roster[] = [
            'accountId' => $accountId,
            'nickname' => $account['nickname'] ?? 'Unknown',
            'roleKey' => $roleKey,
            'roleLabel' => $roleLabels[$roleKey] ?? ucwords(str_replace('_', ' ', $roleKey)),
            'color' => $roleColors[$roleKey] ?? '#7c3aed',
            'joinedAt' => $joinedAt,
            'joinedLabel' => $joinedAt ? $joinedAt->format('M d, Y') : 'Unknown',
            'battles' => $battles,
            'wins' => $wins,
            'losses' => $losses,
            'winRate' => $winRate,
            'avgXp' => $avgXp,
            'survivalRate' => $survivalRate,
            'globalRating' => (int) ($account['global_rating'] ?? 0),
            'lastBattle' => $lastBattle,
            'lastBattleLabel' => $lastBattle ? gmdate('Y-m-d H:i', $lastBattle) . ' UTC' : 'No data',
        ];
    }

    if (!$roster) {
        throw new RuntimeException('Unable to assemble clan roster.');
    }

    $totalBattles = array_sum(array_column($roster, 'battles'));
    $totalWins = array_sum(array_column($roster, 'wins'));
    $averageWinRate = $totalBattles > 0 ? ($totalWins / $totalBattles) * 100 : 0;
    $activeMembers = array_reduce($roster, static function (int $carry, array $player) use ($now): int {
        if (!$player['lastBattle']) {
            return $carry;
        }
        return ($now->getTimestamp() - $player['lastBattle']) <= 7 * 24 * 3600 ? $carry + 1 : $carry;
    }, 0);

    $roleFilters = [];
    foreach ($roster as $player) {
        $roleFilters[$player['roleKey']] = $player['roleLabel'];
    }

    $rosterById = [];
    foreach ($roster as $player) {
        $rosterById[$player['accountId']] = $player;
    }

    if ($selectedPlayerId && isset($rosterById[$selectedPlayerId])) {
        $selectedPlayer = $rosterById[$selectedPlayerId];
    } else {
        $selectedPlayer = reset($rosterById);
        $selectedPlayerId = $selectedPlayer['accountId'];
    }

    $maxBattles = max(array_column($roster, 'battles')) ?: 1;
    $maxWins = max(array_column($roster, 'wins')) ?: 1;
    $performance = [
        round($selectedPlayer['winRate'] * 100, 2),
        $selectedPlayer['avgXp'],
        round($selectedPlayer['survivalRate'] * 100, 2),
        round(($selectedPlayer['battles'] / $maxBattles) * 100, 2),
        round(($selectedPlayer['wins'] / $maxWins) * 100, 2),
    ];

    $timelineMembers = $roster;
    usort($timelineMembers, static function ($a, $b) {
        $aTime = $a['joinedAt'] ? $a['joinedAt']->getTimestamp() : PHP_INT_MAX;
        $bTime = $b['joinedAt'] ? $b['joinedAt']->getTimestamp() : PHP_INT_MAX;
        return $aTime <=> $bTime;
    });
    $timelineMembers = array_slice($timelineMembers, 0, 6);

    if ($selectedPlayerId) {
        try {
            $tankStatsResponse = fetchApi($apiBase . '/wot/tanks/stats/', [
                'application_id' => $appId,
                'account_id' => $selectedPlayerId,
                'fields' => 'tank_id,mark_of_mastery,all.battles,all.wins',
            ]);

            if (($tankStatsResponse['status'] ?? 'error') !== 'ok') {
                throw new RuntimeException('Unable to load tank stats: ' . ($tankStatsResponse['error']['message'] ?? 'Unknown error'));
            }

            $playerTankStats = $tankStatsResponse['data'][$selectedPlayerId] ?? [];
            $tankIds = array_column($playerTankStats, 'tank_id');
            $tankDetails = [];

            foreach (array_chunk($tankIds, 50) as $tankChunk) {
                if (!$tankChunk) {
                    continue;
                }

                $vehiclesResponse = fetchApi($apiBase . '/wot/encyclopedia/vehicles/', [
                    'application_id' => $appId,
                    'tank_id' => implode(',', $tankChunk),
                    'fields' => 'tank_id,name,tier,type,images.contour_icon',
                ]);

                if (($vehiclesResponse['status'] ?? 'error') !== 'ok') {
                    throw new RuntimeException('Unable to load tank encyclopedia: ' . ($vehiclesResponse['error']['message'] ?? 'Unknown error'));
                }

                $tankDetails += $vehiclesResponse['data'];
            }

            foreach ($playerTankStats as $tankStat) {
                $tankId = $tankStat['tank_id'] ?? null;
                if (!$tankId || !isset($tankDetails[$tankId])) {
                    continue;
                }

                $details = $tankDetails[$tankId];
                $tier = (int) ($details['tier'] ?? 0);
                if ($tier === 0) {
                    continue;
                }

                $battles = (int) ($tankStat['all']['battles'] ?? 0);
                $wins = (int) ($tankStat['all']['wins'] ?? 0);
                $winRate = $battles > 0 ? $wins / $battles : 0;
                $playerTanksByTier[$tier][] = [
                    'name' => $details['name'] ?? 'Unknown tank',
                    'image' => $details['images']['contour_icon'] ?? null,
                    'type' => $details['type'] ?? 'unknown',
                    'battles' => $battles,
                    'winRate' => $winRate,
                    'mark' => (int) ($tankStat['mark_of_mastery'] ?? 0),
                    'status' => $winRate >= 0.5,
                ];
            }

            foreach ($playerTanksByTier as &$tierTanks) {
                usort($tierTanks, static function ($a, $b) {
                    return $b['battles'] <=> $a['battles'];
                });
                $tierTanks = array_slice($tierTanks, 0, 10);
            }
            unset($tierTanks);

            ksort($playerTanksByTier);
        } catch (Throwable $tankException) {
            $tankLoadError = $tankException->getMessage();
        }
    }
} catch (Throwable $exception) {
    $error = $exception->getMessage();
}

$selectedPlayerServiceDays = $selectedPlayer && $selectedPlayer['joinedAt']
    ? $selectedPlayer['joinedAt']->diff($now)->days
    : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clan Maneuver Dashboard &middot; <?php echo htmlspecialchars($clan['tag']); ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/styles.css?v=12" />
</head>
<body>
    <div id="loadingOverlay" class="loading-overlay" aria-hidden="true">
        <div class="loading-dots" role="status" aria-live="polite">
            <span></span>
            <span></span>
            <span></span>
        </div>
    </div>
    <div class="aurora" aria-hidden="true"></div>
    <div class="app-shell">
        <header class="hero-card">
            <div class="hero-id">
                <div class="avatar"><?php echo strtoupper(substr($selectedPlayer['nickname'] ?? $clan['tag'], 0, 2)); ?></div>
                <div>
                    <p class="eyebrow">World of Tanks &middot; <?php echo strtoupper($realmKey); ?> realm</p>
                    <h1><?php echo htmlspecialchars($selectedPlayer['nickname'] ?? $clan['name']); ?></h1>
                    <p class="muted">
                        <?php if ($selectedPlayer): ?>
                            <?php echo htmlspecialchars($selectedPlayer['roleLabel']); ?> · <?php echo htmlspecialchars($clan['tag']); ?> / <?php echo htmlspecialchars($clan['name']); ?>
                        <?php else: ?>
                            <?php echo htmlspecialchars($clan['name']); ?>
                        <?php endif; ?>
                    </p>
                </div>
            </div>

            <?php if ($selectedPlayer): ?>
            <div class="hero-metrics">
                <article>
                    <p class="label">Global rating</p>
                    <h2><?php echo number_format($selectedPlayer['globalRating']); ?></h2>
                    <span class="badge positive"><?php echo htmlspecialchars($selectedPlayer['roleLabel']); ?></span>
                </article>
                <article>
                    <p class="label">Win rate</p>
                    <h2><?php echo number_format($selectedPlayer['winRate'] * 100, 2); ?>%</h2>
                    <span class="muted"><?php echo number_format($selectedPlayer['battles']); ?> battles</span>
                </article>
                <article>
                    <p class="label">Service time</p>
                    <h2><?php echo $selectedPlayerServiceDays; ?> days</h2>
                    <span class="muted"><?php echo $selectedPlayer['joinedLabel']; ?></span>
                </article>
            </div>
            <?php endif; ?>

            <div class="hero-tags">
                <span class="chip">Clan · <?php echo htmlspecialchars($clan['tag']); ?></span>
                <span class="chip">Leader · <?php echo htmlspecialchars($clan['leader'] ?? 'Unknown'); ?></span>
                <span class="chip">Members · <?php echo $clan['members_count']; ?></span>
                <span class="chip">Created · <?php echo htmlspecialchars($clan['created']); ?></span>
                <span class="chip">Last update · <?php echo $now->format('Y-m-d H:i'); ?> UTC</span>
            </div>

            <form class="hero-form" method="get">
                <div class="hero-form-group">
                    <label for="clan_id">Clan ID</label>
                    <input type="text" id="clan_id" name="clan_id" value="<?php echo htmlspecialchars($clanId); ?>" />
                </div>
                <div class="hero-form-group">
                    <label for="realm">Realm</label>
                    <select id="realm" name="realm">
                        <?php foreach ($realmMap as $key => $domain): ?>
                            <option value="<?php echo $key; ?>" <?php echo $key === $realmKey ? 'selected' : ''; ?>><?php echo strtoupper($key); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php if ($selectedPlayer): ?>
                <div class="hero-form-group">
                    <label for="player">Player</label>
                    <select id="player" name="player">
                        <?php foreach ($roster as $player): ?>
                            <option value="<?php echo $player['accountId']; ?>" <?php echo $player['accountId'] === $selectedPlayerId ? 'selected' : ''; ?>><?php echo htmlspecialchars($player['nickname']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php endif; ?>
                <button type="submit" class="ghost">Load data</button>
            </form>
        </header>

        <?php if ($error): ?>
            <main class="dashboard">
                <section class="card">
                    <p class="label">Live data error</p>
                    <h3><?php echo htmlspecialchars($error); ?></h3>
                    <p class="muted">Update the clan ID or realm above and try again.</p>
                </section>
            </main>
        <?php elseif ($selectedPlayer): ?>
        <main class="dashboard">
            <section class="grid">
                <article class="card tank-card">
                    <div class="card-header">
                        <p class="label">Garage overview</p>
                        <span class="badge neutral">Favorite hulls</span>
                    </div>
                    <?php if ($tankLoadError): ?>
                        <p class="muted"><?php echo htmlspecialchars($tankLoadError); ?></p>
                    <?php elseif (!$playerTanksByTier): ?>
                        <p class="muted">Tank dossier unavailable for this player.</p>
                    <?php else: ?>
                    <div class="tank-grid">
                        <?php foreach ($playerTanksByTier as $tier => $tanks): ?>
                            <div class="tank-column">
                                <h4>Tier <?php echo $tier; ?> tanks</h4>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Config tank</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($tanks as $tank): ?>
                                            <tr>
                                                <td>
                                                    <div class="tank-info">
                                                        <?php if ($tank['image']): ?>
                                                            <img src="<?php echo htmlspecialchars($tank['image']); ?>" alt="<?php echo htmlspecialchars($tank['name']); ?>" loading="lazy" />
                                                        <?php endif; ?>
                                                        <div>
                                                            <strong><?php echo htmlspecialchars($tank['name']); ?></strong>
                                                            <p class="muted small"><?php echo number_format($tank['battles']); ?> battles · <?php echo number_format($tank['winRate'] * 100, 1); ?>% WR</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span class="status-chip <?php echo $tank['status'] ? 'online' : 'offline'; ?>" title="<?php echo $tank['status'] ? 'Win rate above 50%' : 'Win rate below 50%'; ?>">
                                                        <?php echo $tank['status'] ? '✔' : '✕'; ?>
                                                    </span>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    <?php endif; ?>
                </article>
            </section>
            
            <section class="grid">
                <article class="card">
                    <div class="card-header">
                        <p class="label">Clan readiness</p>
                        <span class="badge positive"><?php echo $activeMembers; ?> active this week</span>
                    </div>
                    <h3><?php echo number_format($averageWinRate, 2); ?>%</h3>
                    <p class="muted">Average win rate across <?php echo count($roster); ?> members.</p>
                    <div class="progress" role="img" aria-label="Average win rate <?php echo number_format($averageWinRate, 2); ?> percent">
                        <span style="width: <?php echo min(100, max(0, $averageWinRate)); ?>%"></span>
                    </div>
                    <p class="muted small">Total battles <?php echo number_format($totalBattles); ?></p>
                </article>

                <article class="card performance-card">
                    <div class="card-header">
                        <p class="label">Performance arc</p>
                        <button class="ghost" id="sparkline-boost" type="button">Boost</button>
                    </div>
                    <canvas id="performanceChart" width="320" height="160" aria-label="Performance chart"></canvas>
                    <ul class="chart-legend">
                        <?php foreach ($performanceLabels as $index => $label): ?>
                            <li><span style="--color: <?php echo $performanceColors[$index % count($performanceColors)]; ?>"></span><?php echo htmlspecialchars($label); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </article>

                <article class="card">
                    <div class="card-header">
                        <p class="label">Service timeline</p>
                        <span class="badge neutral">UTC synced</span>
                    </div>
                    <ul class="timeline">
                        <?php foreach ($timelineMembers as $member): ?>
                            <li>
                                <div class="timeline-point" style="--color: <?php echo $member['color']; ?>"></div>
                                <div>
                                    <strong><?php echo htmlspecialchars($member['nickname']); ?></strong>
                                    <p class="muted small"><?php echo htmlspecialchars($member['joinedLabel']); ?> · <?php echo htmlspecialchars($member['roleLabel']); ?></p>
                                </div>
                                <span class="badge neutral"><?php echo number_format($member['battles']); ?> battles</span>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </article>
            </section>

            <section class="card table-card">
                <div class="card-header">
                    <div>
                        <p class="label">Clan roster</p>
                        <h3>Live member dossier</h3>
                    </div>
                    <div class="actions">
                        <div class="filter-group" role="toolbar" aria-label="Filter members by role">
                            <button class="chip active" data-filter="all" type="button">All</button>
                            <?php foreach ($roleFilters as $roleKey => $roleLabel): ?>
                                <button class="chip" data-filter="<?php echo htmlspecialchars($roleKey); ?>" type="button"><?php echo htmlspecialchars($roleLabel); ?></button>
                            <?php endforeach; ?>
                        </div>
                        <label class="search">
                            <input type="search" id="rosterSearch" placeholder="Search players" />
                            <span>⌕</span>
                        </label>
                    </div>
                </div>

                <div class="table-wrapper">
                    <table id="rosterTable">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Role</th>
                                <th>Battles</th>
                                <th>Wins</th>
                                <th>Win rate</th>
                                <th>Avg XP</th>
                                <th>Last battle</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($roster as $member): ?>
                                <?php $isSelectedRow = $selectedPlayer && $member['accountId'] === $selectedPlayer['accountId']; ?>
                                <tr
                                    class="roster-row<?php echo $isSelectedRow ? ' is-selected' : ''; ?>"
                                    data-role="<?php echo htmlspecialchars($member['roleKey']); ?>"
                                    data-account-id="<?php echo $member['accountId']; ?>"
                                >
                                    <td>
                                        <strong><?php echo htmlspecialchars($member['nickname']); ?></strong>
                                        <p class="muted small"><?php echo htmlspecialchars($member['joinedLabel']); ?> · Rating <?php echo number_format($member['globalRating']); ?></p>
                                    </td>
                                    <td><span class="pill" style="--color: <?php echo $member['color']; ?>"><?php echo htmlspecialchars($member['roleLabel']); ?></span></td>
                                    <td><?php echo number_format($member['battles']); ?></td>
                                    <td><?php echo number_format($member['wins']); ?></td>
                                    <td><?php echo number_format($member['winRate'] * 100, 2); ?>%</td>
                                    <td><?php echo number_format($member['avgXp']); ?></td>
                                    <td><?php echo htmlspecialchars($member['lastBattleLabel']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
        <?php endif; ?>
    </div>

    <?php if ($selectedPlayer): ?>
    <script>
        window.APP_DATA = {
            performance: <?php echo json_encode($performance); ?>
        };
    </script>
    <script src="assets/js/app.js?v=5" defer></script>
    <?php endif; ?>
</body>
</html>
