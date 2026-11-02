# set-videos.ps1 —— 换掉开屏的两段视频（不用碰 node_modules，也不会被更新覆盖）
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\set-videos.ps1 -Clip1 .\开场.mp4
#   powershell -ExecutionPolicy Bypass -File .\set-videos.ps1 -Clip1 .\开场.mp4 -Clip2 .\第二段.mp4
#   powershell -ExecutionPolicy Bypass -File .\set-videos.ps1 -Clip1 .\a.mp4 -Clip2 .\b.mp4 -DryRun
#
# 做的事：
#   1) 把视频复制到 %USERPROFILE%\.dsh\startup-cyrene-media\（插件优先读这个目录）；
#   2) 把 ~/.dsh/startup-cyrene.json 的 segments 指向它们，其余配置保持不变；
#   3) 打印「重启客户端」的提示。
#
# 参数：
#   -Clip1 <path>   第一段（必填）
#   -Clip2 <path>   第二段（可选；不传则保留原来的第二段）
#   -Name1 <file>   复制到素材目录后的文件名，默认 clip1.mp4
#   -Name2 <file>   同上，默认 clip2.mp4
#   -DryRun         只打印将要做什么

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Clip1,
    [string]$Clip2 = '',
    [string]$Name1 = 'clip1.mp4',
    [string]$Name2 = 'clip2.mp4',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step($text) { Write-Host "[*] $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "[+] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "[!] $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "[x] $text" -ForegroundColor Red }

$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$mediaDir = Join-Path $homeDir 'startup-cyrene-media'
$configPath = Join-Path $homeDir 'startup-cyrene.json'
$allowed = @('.mp4', '.m4v', '.webm', '.mov')

function Assert-Video($path, $label) {
    if (-not (Test-Path $path)) { Write-Err "$label 不存在：$path"; exit 1 }
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    if ($allowed -notcontains $ext) {
        Write-Err "$label 的扩展名是 $ext，只支持 $($allowed -join ' / ')"
        exit 1
    }
    return (Resolve-Path $path).Path
}

$video1 = Assert-Video $Clip1 'Clip1'
$video2 = $null
if ($Clip2) { $video2 = Assert-Video $Clip2 'Clip2' }

Write-Step "素材目录：$mediaDir"
Write-Step "配置文件：$configPath"
Write-Step "第一段：$video1 -> $Name1"
if ($video2) { Write-Step "第二段：$video2 -> $Name2" } else { Write-Step "第二段：保持不变" }

if ($DryRun) {
    Write-Warn2 "-DryRun：只打印，不复制、不写配置。"
    exit 0
}

New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null
Copy-Item $video1 (Join-Path $mediaDir $Name1) -Force
Write-Ok "已复制第一段"

if ($video2) {
    Copy-Item $video2 (Join-Path $mediaDir $Name2) -Force
    Write-Ok "已复制第二段"
}

# 读取现有配置，只替换 segments，其余字段保留
$cfg = $null
if (Test-Path $configPath) {
    try { $cfg = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $cfg = $null }
}
if ($null -eq $cfg) { $cfg = [pscustomobject]@{} }

$segments = @([pscustomobject]@{ file = $Name1; volume = 1 })
if ($video2) {
    $segments += [pscustomobject]@{ file = $Name2; volume = 1 }
} elseif ($cfg.PSObject.Properties.Name -contains 'segments' -and $cfg.segments.Count -ge 2) {
    $segments += $cfg.segments[1]
}

$cfg | Add-Member -NotePropertyName segments -NotePropertyValue $segments -Force
if (-not ($cfg.PSObject.Properties.Name -contains 'enabled')) {
    $cfg | Add-Member -NotePropertyName enabled -NotePropertyValue $true -Force
}

$json = $cfg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Ok "配置已更新"

Write-Host ""
Write-Host "重启 DeepSeek Harness 后生效。" -ForegroundColor Green
Write-Host "    想还原内置素材：删除 $configPath ，以及 $mediaDir 里的文件。"
