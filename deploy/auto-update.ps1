<#
.SYNOPSIS
    Updates the live GSONEO server when `main` on GitHub has new commits.

.DESCRIPTION
    Run every few minutes by the "GSONEO auto-update" scheduled task
    (docs/DEPLOYMENT.md, section 11.3). When the server is already on the
    latest `main` it does nothing. Otherwise it runs the update steps of
    section 11 in order:

        backup.ps1, artisan down, fast-forward to origin/main, rebuild the
        app image if docker/php changed, composer install, npm ci, npm run
        build, migrate, PermissionSeeder, optimize, erd:generate, artisan up

    The server only reads from GitHub, so nothing outside can make it run
    code. Whatever is merged into `main` goes live within minutes, so protect
    `main` on GitHub.

    It refuses to update, and leaves the site as it is, when the checkout has
    local changes, is on another branch, or has commits `main` does not.

    If a step fails after the code was updated, the site stays on the
    maintenance page and later runs do nothing until someone fixes the problem
    and runs this script with -Retry. Everything is logged to
    storage\logs\auto-update.log.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\gsoneo\deploy\auto-update.ps1 -DryRun

    Says whether an update is waiting and what it would run, changing nothing.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\gsoneo\deploy\auto-update.ps1 -Retry

    After a failed update: runs the steps again, even though the code is
    already on the latest `main`.
#>
param(
    # The checkout the live site runs from.
    [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
    [string]$Branch = 'main',
    # Section 10.1. The update stops if it is missing or fails.
    [string]$BackupScript = '',
    # Used only to rebuild the app image; missing files are skipped.
    [string[]]$ComposeFiles = @('docker-compose.yaml', 'docker-compose.prod.yaml'),
    [switch]$Retry,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $AppDir

if (-not $BackupScript) { $BackupScript = Join-Path $AppDir 'backup.ps1' }
$logFile = Join-Path $AppDir 'storage\logs\auto-update.log'
$failedMarker = Join-Path $AppDir 'storage\auto-update-failed.txt'

function Write-Log([string]$Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Output $line
}

# Runs a native command, logs its output, and throws on a non-zero exit code.
# Native commands write progress to stderr, which PowerShell 5.1 would turn
# into errors under 'Stop', so the preference is relaxed while they run.
function Invoke-Native([string]$Name, [scriptblock]$Command, [switch]$Quiet) {
    if (-not $Quiet) { Write-Log "  $Name" }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Command 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if (-not $Quiet -and $output) {
        Add-Content -LiteralPath $logFile -Value ($output | ForEach-Object { "      $_" }) -Encoding UTF8
    }
    if ($code -ne 0) {
        if ($Quiet -and $output) { Add-Content -LiteralPath $logFile -Value ($output | ForEach-Object { "      $_" }) -Encoding UTF8 }
        throw "$Name failed (exit code $code)"
    }
    return $output
}

function Invoke-Artisan([string]$Name, [string[]]$Arguments) {
    Invoke-Native $Name { docker compose exec -T app php artisan @Arguments } | Out-Null
}

# One run at a time, even if a slow update overlaps the next scheduled run.
$mutex = New-Object System.Threading.Mutex($false, 'Global\GSONEO-auto-update')
try {
    $acquired = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    $acquired = $true   # A previous run was killed while holding it; the lock is ours now.
}
if (-not $acquired) { exit 0 }

$siteDown = $false
$codeUpdated = $false
try {
    if ((Test-Path -LiteralPath $failedMarker) -and -not $Retry) {
        # Already logged when it failed; the task's last result shows the failure.
        exit 1
    }

    Invoke-Native 'git fetch' { git fetch --quiet origin $Branch } -Quiet | Out-Null
    $current = (Invoke-Native 'git rev-parse HEAD' { git rev-parse HEAD } -Quiet | Select-Object -First 1).Trim()
    $target = (Invoke-Native "git rev-parse origin/$Branch" { git rev-parse "origin/$Branch" } -Quiet | Select-Object -First 1).Trim()

    if ($current -eq $target -and -not $Retry) {
        if ($DryRun) { Write-Output "Up to date with origin/$Branch ($($current.Substring(0, 7)))." }
        exit 0
    }

    $onBranch = (Invoke-Native 'git rev-parse --abbrev-ref HEAD' { git rev-parse --abbrev-ref HEAD } -Quiet | Select-Object -First 1).Trim()
    if ($onBranch -ne $Branch) {
        throw "The checkout is on '$onBranch', not '$Branch'. Not updating."
    }

    # The server regenerates the ERD after every migration; that copy is not a local change.
    $erdChanged = Invoke-Native 'git status docs/erd' { git status --porcelain --untracked-files=no -- docs/erd } -Quiet
    if ($erdChanged -and -not $DryRun) { Invoke-Native 'git checkout docs/erd' { git checkout -- docs/erd } -Quiet | Out-Null }
    $dirty = Invoke-Native 'git status' { git status --porcelain --untracked-files=no -- . ':(exclude)docs/erd' } -Quiet
    if ($dirty) {
        throw "The checkout has local changes, so it was not updated:`n      $($dirty -join "`n      ")"
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    git merge-base --is-ancestor HEAD "origin/$Branch" 2>$null
    $isAncestor = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $previous
    if (-not $isAncestor) {
        throw "The checkout has commits that origin/$Branch does not, so it cannot be fast-forwarded. Not updating."
    }

    $changed = @(Invoke-Native 'git diff' { git diff --name-only $current $target } -Quiet)
    $rebuild = [bool]($changed | Where-Object { $_ -like 'docker/php/*' })
    $commits = Invoke-Native 'git log' { git log --oneline "$current..$target" } -Quiet

    if ($DryRun) {
        Write-Output "Would update $($current.Substring(0, 7)) -> $($target.Substring(0, 7)):"
        $commits | ForEach-Object { Write-Output "  $_" }
        if ($rebuild) { Write-Output 'docker/php changed: the app image would be rebuilt.' }
        if ($Retry) { Write-Output 'With -Retry the update steps would run even if there is nothing new.' }
        exit 0
    }

    if ($current -eq $target) {
        Write-Log "Retrying the update steps on $($current.Substring(0, 7))"
    } else {
        Write-Log "Updating $($current.Substring(0, 7)) -> $($target.Substring(0, 7))"
        $commits | ForEach-Object { Write-Log "    $_" }
    }

    if (-not (Test-Path -LiteralPath $BackupScript)) {
        throw "Backup script $BackupScript not found. Not updating without a backup."
    }
    Invoke-Native 'backup' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BackupScript } | Out-Null

    Invoke-Artisan 'artisan down' @('down', '--retry=60')
    $siteDown = $true

    Invoke-Native "git merge --ff-only origin/$Branch" { git merge --ff-only "origin/$Branch" } | Out-Null
    $codeUpdated = $true

    if ($rebuild) {
        $files = @($ComposeFiles | Where-Object { Test-Path -LiteralPath (Join-Path $AppDir $_) } | ForEach-Object { '-f'; $_ })
        Invoke-Native 'rebuild the app image' { docker compose @files up -d --build app } | Out-Null
    }

    Invoke-Native 'composer install' { docker compose exec -T app composer install --no-dev --optimize-autoloader --no-interaction } | Out-Null
    Invoke-Native 'npm ci' { docker compose exec -T app npm ci } | Out-Null
    Invoke-Native 'npm run build' { docker compose exec -T app npm run build } | Out-Null
    Invoke-Artisan 'migrate' @('migrate', '--force')
    Invoke-Artisan 'PermissionSeeder' @('db:seed', '--class=PermissionSeeder', '--force')
    Invoke-Artisan 'optimize' @('optimize')
    Invoke-Artisan 'erd:generate' @('erd:generate')

    Invoke-Artisan 'artisan up' @('up')
    $siteDown = $false

    if (Test-Path -LiteralPath $failedMarker) { Remove-Item -LiteralPath $failedMarker }
    Write-Log "Done. Live on $($target.Substring(0, 7))."
    exit 0
} catch {
    Write-Log "FAILED: $($_.Exception.Message)"

    if ($siteDown -and -not $codeUpdated) {
        # Nothing changed yet: put the site back as it was.
        try {
            Invoke-Artisan 'artisan up' @('up')
            $siteDown = $false
        } catch {
            Write-Log "Could not bring the site back up: $($_.Exception.Message)"
        }
    }

    if ($siteDown) {
        Set-Content -LiteralPath $failedMarker -Encoding UTF8 -Value @(
            "Auto-update failed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $($_.Exception.Message)",
            'The site is on the maintenance page. See storage\logs\auto-update.log, fix the problem,',
            'then run deploy\auto-update.ps1 -Retry (docs/DEPLOYMENT.md, section 11.3).'
        )
        Write-Log 'The site stays on the maintenance page. Fix the problem, then run deploy\auto-update.ps1 -Retry.'
    }
    exit 1
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
