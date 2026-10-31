# dsh-startup-cyrene —— 一键安装脚本（Windows / PowerShell 5.1+）
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Tgz "D:\path\to\pkg.tgz"
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
#
# 做的事：
#   1) 检查 DeepSeek Harness 是否还在运行（运行中安装会 EPERM，甚至清空 assets）；
#   2) 找 dsh 命令（PATH 里没有就用桌面版自带的那份）；
#   3) 用插件管理器安装 tgz（找不到 tgz 就退回从 Gitee 仓库安装）；
#   4) 打印「重启客户端」的提示。
#
# 参数：
#   -Tgz <path>    指定插件包；缺省时在脚本同级目录找 dsh-startup-cyrene-*.tgz
#   -Git           强制从 Git 仓库安装（跳过本地 tgz）
#   -Uninstall     卸载，不安装
#   -Profile <名>  目标 profile，默认 desktop
#   -Force         客户端在运行也继续（不推荐）
#   -DryRun        只打印将要执行的命令，不真的执行

[CmdletBinding()]
param(
    [string]$Tgz = '',
    [switch]$Git,
    [switch]$Uninstall,
    [string]$Profile = 'desktop',
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://gitee.com/qyb7316/deepseek-the-rise-of-cyrene.git'
$PackageName = 'dsh-startup-cyrene'

function Write-Step($text) { Write-Host "[*] $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "[+] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "[!] $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "[x] $text" -ForegroundColor Red }

# 1) 客户端是否在运行
$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'DeepSeek Harness*' })
if ($running.Count -gt 0 -and -not $Uninstall -and -not $DryRun -and -not $Force) {
    Write-Err "DeepSeek Harness 还在运行（$($running.Count) 个进程）。"
    Write-Host "    请先完全退出客户端（托盘图标右键退出），再重新运行本脚本。"
    Write-Host "    运行中安装会因文件占用失败（EPERM），严重时会把包的 assets/ 清空。"
    Write-Host "    确实要强行继续：加 -Force（不推荐）"
    exit 1
}

# 2) 找 dsh 命令
$dsh = $null
$cmd = Get-Command dsh -ErrorAction SilentlyContinue
if ($cmd) {
    $dsh = $cmd.Source
} else {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
        (Join-Path $env:ProgramFiles 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $dsh = $c; break }
    }
}
if (-not $dsh) {
    Write-Err "找不到 dsh 命令。请确认已安装 DeepSeek Harness 桌面版，或把它加入 PATH。"
    exit 1
}
Write-Step "dsh: $dsh"

# 3) 组装命令
$dshArgs = @('plugin', '--profile', $Profile)
if ($Uninstall) {
    $dshArgs += @('remove', $PackageName)
    Write-Step "将执行：dsh $($dshArgs -join ' ')"
} else {
    $spec = $null
    if (-not $Git) {
        if ($Tgz) {
            if (-not (Test-Path $Tgz)) { Write-Err "指定的 tgz 不存在：$Tgz"; exit 1 }
            $spec = (Resolve-Path $Tgz).Path
        } else {
            $here = Split-Path -Parent $MyInvocation.MyCommand.Path
            $found = @(Get-ChildItem -Path $here -Filter 'dsh-startup-cyrene-*.tgz' -File -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 1)
            if ($found.Count -eq 0) {
                $found = @(Get-ChildItem -Path (Join-Path $here 'release') -Filter 'dsh-startup-cyrene-*.tgz' -File -ErrorAction SilentlyContinue |
                    Sort-Object Name -Descending | Select-Object -First 1)
            }
            if ($found.Count -gt 0) { $spec = 'file:' + $found[0].FullName }
        }
    }
    if (-not $spec) {
        $spec = 'git+' + $RepoUrl
        Write-Step "本地没有 tgz，改用仓库安装：$spec"
    }
    $dshArgs += @('add', $spec)
    Write-Step "将执行：dsh $($dshArgs -join ' ')"
}

# 4) 执行
if ($DryRun) {
    Write-Warn2 "-DryRun：只打印，不执行。"
    exit 0
}

& $dsh @args
if ($LASTEXITCODE -ne 0) {
    Write-Err "命令执行失败（exit $LASTEXITCODE）。若报 EPERM，请确认客户端已完全退出后重试。"
    exit $LASTEXITCODE
}

if ($Uninstall) {
    Write-Ok "已卸载 $PackageName。重启客户端后生效。"
} else {
    Write-Ok "安装完成！请重启 DeepSeek Harness（完全退出再打开）即可看到开屏动画。"
    Write-Host "    配置文件（可选）：$env:USERPROFILE\.dsh\startup-cyrene.json"
    Write-Host "    卸载命令：dsh plugin --profile $Profile remove $PackageName"
}
