$ErrorActionPreference='Stop'
$manifestPath=Join-Path $PSScriptRoot 'manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host 'Google Drive setup for X Image Flow Collector Lab'
Write-Host '1. Enable Google Drive API in your Google Cloud project.'
Write-Host '2. Create an OAuth client of type Chrome Extension.'
Write-Host '3. Use your CURRENT extension ID as Item ID. Do not change installation path.'
Write-Host '4. Paste the client ID below (not a client secret, token or password).'
$clientId=(Read-Host 'OAuth Client ID').Trim()
if($clientId -notmatch '^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$'){throw 'Invalid client ID. No file changed.'}
$backupPath=Join-Path $PSScriptRoot 'manifest.before-google-drive.json'
if(-not(Test-Path -LiteralPath $backupPath)){Copy-Item -LiteralPath $manifestPath -Destination $backupPath}
$oauth=[PSCustomObject]@{client_id=$clientId;scopes=@('https://www.googleapis.com/auth/drive.file')}
$manifest|Add-Member -MemberType NoteProperty -Name oauth2 -Value $oauth -Force
[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 30),[Text.UTF8Encoding]::new($false))
Write-Host 'Done. Reload THIS extension in chrome://extensions and reopen the local library.'
Write-Host 'Then choose Connect and sync. Your existing extension ID and local library are preserved.'
