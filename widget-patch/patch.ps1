# widget-patch/patch.ps1 —— 给余额挂件（免动画版）打「等开屏结束再问好」的补丁
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\patch.ps1
#   powershell -ExecutionPolicy Bypass -File .\patch.ps1 -DryRun
#   powershell -ExecutionPolicy Bypass -File .\patch.ps1 -Uninstall
#   powershell -ExecutionPolicy Bypass -File .\patch.ps1 -Profile desktop -Path "D:\...\dsh-cyrene-whale-widget-noanim"
#
# 做的事：把挂件的 assets/whale-widget.js 换成打过补丁的版本（先备份为 .bak-cyrene）。
# 重复运行会识别「已打过补丁」并跳过；-Uninstall 从备份还原。

[CmdletBinding()]
param(
    [string]$Profile = 'desktop',
    [string]$Path = '',
    [switch]$Uninstall,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step($text) { Write-Host "[*] $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "[+] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "[!] $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "[x] $text" -ForegroundColor Red }

$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'DeepSeek Harness*' })
if ($running.Count -gt 0 -and -not $DryRun) {
    Write-Err "DeepSeek Harness 还在运行（$($running.Count) 个进程）。请先完全退出客户端再打补丁。"
    exit 1
}

$pkgDir = $Path
if (-not $pkgDir) {
    $pkgDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile\node_modules\dsh-cyrene-whale-widget-noanim"
}
if (-not (Test-Path $pkgDir)) {
    Write-Err "找不到挂件目录：$pkgDir"
    Write-Host "    请确认已安装 dsh-cyrene-whale-widget-noanim，或用 -Path 指定它的安装目录。"
    exit 1
}

$target = Join-Path $pkgDir 'assets\whale-widget.js'
$backup = "$target.bak-cyrene"
$source = Join-Path $PSScriptRoot 'whale-widget.cyrene.1.js'

if (-not (Test-Path $target)) {
    Write-Err "找不到目标文件：$target"
    exit 1
}

if ($Uninstall) {
    if (-not (Test-Path $backup)) {
        Write-Warn2 "没有找到备份 $backup，无法还原。可重装挂件来恢复原文件。"
        exit 1
    }
    if ($DryRun) {
        Write-Warn2 "-DryRun：会用 $backup 覆盖 $target（未执行）"
        exit 0
    }
    Copy-Item $backup $target -Force
    Write-Ok "已还原：$target"
    Write-Host "    重启客户端后生效。"
    exit 0
}

if (-not (Test-Path $source)) {
    Write-Err "补丁文件缺失：$source"
    exit 1
}

$current = [System.IO.File]::ReadAllText($target)
if ($current.Contains('cyrene-loading-done')) {
    Write-Ok "已经是打过补丁的版本，跳过。"
    exit 0
}

Write-Step "目标：$target"
Write-Step "备份：$backup"
if ($DryRun) {
    Write-Warn2 "-DryRun：只检查，不写入。"
    exit 0
}

if (-not (Test-Path $backup)) {
    Copy-Item $target $backup -Force
    Write-Step "已备份原文件"
}
Copy-Item $source $target -Force

$after = [System.IO.File]::ReadAllText($target)
if (-not $after.Contains('cyrene-loading-done')) {
    Write-Err "写入后校验失败：未找到补丁标记。请从备份还原。"
    exit 1
}
Write-Ok "补丁已应用。重启客户端后，问候语音会等开屏结束再播。"
Write-Host "    还原：powershell -ExecutionPolicy Bypass -File .\patch.ps1 -Uninstall"
Write-Host "    注意：重装/升级挂件会覆盖掉补丁，需要重新打。"
