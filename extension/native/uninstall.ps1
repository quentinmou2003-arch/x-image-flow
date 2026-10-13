$ErrorActionPreference = 'Stop'
foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32, [Microsoft.Win32.RegistryView]::Registry64)) {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, $view)
    try { $base.DeleteSubKey('Software\Google\Chrome\NativeMessagingHosts\com.ximageflow.clipboard', $false) } finally { $base.Dispose() }
}
$installDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'XImageFlowClipboard'
foreach ($name in @('host.exe','host.json')) { $file = Join-Path $installDir $name; if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.MessageBox]::Show('助手已卸载。已复制图片的临时缓存保留，以免影响尚未粘贴的文件。', '拾图') | Out-Null
