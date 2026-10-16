$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root '.local-admin.env'
$examplePath = Join-Path $root '.local-admin.env.example'

if (-not (Test-Path -LiteralPath $configPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $configPath
  Write-Host 'Bir kerelik ayar gerekli: .local-admin.env dosyasini acip' -ForegroundColor Yellow
  Write-Host 'GOOGLE_APPLICATION_CREDENTIALS satirina service account JSON dosyanizin yolunu yazin.' -ForegroundColor Yellow
  Start-Process notepad.exe -ArgumentList @($configPath)
  Read-Host 'Ayar dosyasini kaydettikten sonra tekrar baslatmak icin Enter tusuna basin'
  exit 1
}

$line = Get-Content -LiteralPath $configPath -Encoding utf8 |
  Where-Object { $_ -match '^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=' } |
  Select-Object -First 1

if (-not $line) {
  Write-Host 'GOOGLE_APPLICATION_CREDENTIALS tanimli degil. .local-admin.env dosyasini kontrol edin.' -ForegroundColor Red
  Read-Host 'Kapatmak icin Enter tusuna basin'
  exit 1
}

$credentialPath = ($line -replace '^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=', '').Trim()
if ([string]::IsNullOrWhiteSpace($credentialPath) -or -not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
  Write-Host 'Service account JSON dosyasi bulunamadi:' -ForegroundColor Red
  Write-Host $credentialPath -ForegroundColor Red
  Read-Host 'Kapatmak icin Enter tusuna basin'
  exit 1
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $credentialPath
Set-Location -LiteralPath $root
& node scripts/local-student-account-manager.mjs
$exitCode = $LASTEXITCODE
Read-Host 'Kapatmak icin Enter tusuna basin'
exit $exitCode
