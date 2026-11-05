param([string]$ExtensionId, [switch]$Quiet)
$ErrorActionPreference = 'Stop'
try {
    if (-not $ExtensionId) {
        $extensionRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
        $userData = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Google\Chrome\User Data'
        $matchesFound = @()
        foreach ($profile in @(Get-ChildItem -LiteralPath $userData -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$' })) {
            foreach ($prefName in @('Secure Preferences','Preferences')) {
                $prefPath = Join-Path $profile.FullName $prefName
                if (-not (Test-Path -LiteralPath $prefPath)) { continue }
                try {
                    $prefs = Get-Content -LiteralPath $prefPath -Raw -Encoding UTF8 | ConvertFrom-Json
                    foreach ($property in $prefs.extensions.settings.PSObject.Properties) {
                        $loadedPath = $property.Value.path
                        if ($property.Name -match '^[a-p]{32}$' -and $loadedPath -and [IO.Path]::IsPathRooted($loadedPath) -and [IO.Path]::GetFullPath($loadedPath).TrimEnd('\') -eq $extensionRoot) { $matchesFound += $property.Name }
                    }
                } catch {}
            }
        }
        $matchesFound = @($matchesFound | Select-Object -Unique)
        if ($matchesFound.Count -eq 1) { $ExtensionId = $matchesFound[0] }
        elseif ($Quiet) { throw '无法唯一识别当前扩展 ID，请运行普通安装器选择。' }
    }
    if (-not $ExtensionId) {
        Add-Type -AssemblyName Microsoft.VisualBasic
        $ExtensionId = [Microsoft.VisualBasic.Interaction]::InputBox('打开拾图顶部的「多图助手」，复制插件 ID 并粘贴到这里。', '安装拾图多图剪贴板助手')
    }
    $ExtensionId = $ExtensionId.Trim().ToLowerInvariant()
    if ($ExtensionId -notmatch '^[a-p]{32}$') { throw '插件 ID 无效，应为 32 个 a–p 字母。取消安装不会修改系统。' }
    $installDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'XImageFlowClipboard'
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
    if (-not (Test-Path -LiteralPath $compiler)) { throw '未找到 Windows 自带的 .NET Framework 编译器。' }
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    $exePath = Join-Path $installDir 'host.exe'
    & $compiler /nologo /codepage:65001 /target:winexe "/out:$exePath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'host.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exePath)) { throw '助手编译失败，没有注册连接。' }
    $manifestPath = Join-Path $installDir 'host.json'
    $origins = @("chrome-extension://$ExtensionId/")
    if (Test-Path -LiteralPath $manifestPath) {
        try { foreach ($origin in ((Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).allowed_origins)) { if ($origin -match '^chrome-extension://[a-p]{32}/$') { $origins += $origin } } } catch {}
    }
    $manifest = @{name='com.ximageflow.clipboard';description='X Image Flow local PNG and GIF clipboard helper';path=$exePath;type='stdio';allowed_origins=@($origins | Select-Object -Unique)} | ConvertTo-Json
    [IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32, [Microsoft.Win32.RegistryView]::Registry64)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, $view)
        try { $key = $base.CreateSubKey('Software\Google\Chrome\NativeMessagingHosts\com.ximageflow.clipboard'); try { $key.SetValue('', $manifestPath) } finally { $key.Dispose() } } finally { $base.Dispose() }
    }
    Add-Type -AssemblyName System.Windows.Forms
    if(-not $Quiet){[Windows.Forms.MessageBox]::Show('安装完成。回到拾图，点「多图助手 → 检查连接」。无需重启电脑。普通多图使用独立 PNG 文件剪贴板，GIF 使用动图文件。助手 1.3.0，QQ 的接收形式由 QQ 版本决定。', '拾图') | Out-Null}
    Write-Output 'Helper registration completed.'
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    if($Quiet){Write-Error $_.Exception.Message}else{[Windows.Forms.MessageBox]::Show($_.Exception.Message, '拾图安装未完成') | Out-Null}
    exit 1
}
