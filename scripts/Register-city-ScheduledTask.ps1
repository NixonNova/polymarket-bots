[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $CitySlug,
  [Parameter(Mandatory = $true)]
  [string] $BuildScript,
  [Parameter(Mandatory = $true)]
  [string] $OutDir,
  [Parameter(Mandatory = $true)]
  [string] $CityTimeZoneIana,
  [string] $TaskNamePrefix = "Polymarket_WeatherMetar",
  [switch] $SkipBuild,
  [switch] $RunWhetherUserLoggedOnOrNot,
  [string] $UserName = "$env:COMPUTERNAME\$env:USERNAME",
  [string] $Password,
  [switch] $RunWithHighestPrivileges,
  [switch] $Unregister
)

$ErrorActionPreference = "Stop"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$taskName = "$TaskNamePrefix-$CitySlug"
$nodePath = "C:\Program Files\nodejs\node.exe"
$workingDir = Join-Path $RepoRoot $OutDir

function Resolve-WindowsTimeZoneId {
  param([string] $IanaId)
  $map = @{
    "America/New_York" = "Eastern Standard Time"
    "Europe/London" = "GMT Standard Time"
    "America/Chicago" = "Central Standard Time"
    "America/Denver" = "Mountain Standard Time"
    "America/Los_Angeles" = "Pacific Standard Time"
    "Asia/Tokyo" = "Tokyo Standard Time"
    "Asia/Shanghai" = "China Standard Time"
    "America/Toronto" = "Eastern Standard Time"
    "America/Argentina/Buenos_Aires" = "Argentina Standard Time"
    "Europe/Istanbul" = "Turkey Standard Time"
    "Pacific/Auckland" = "New Zealand Standard Time"
    "America/Sao_Paulo" = "E. South America Standard Time"
    "Asia/Kolkata" = "India Standard Time"
    "Europe/Berlin" = "W. Europe Standard Time"
    "Asia/Jerusalem" = "Israel Standard Time"
    "Asia/Hong_Kong" = "China Standard Time"
    "Asia/Singapore" = "Singapore Standard Time"
    "Europe/Warsaw" = "Central European Standard Time"
    "Europe/Madrid" = "Romance Standard Time"
    "Asia/Taipei" = "Taipei Standard Time"
    "Europe/Rome" = "W. Europe Standard Time"
    "Europe/Moscow" = "Russian Standard Time"
    "America/Mexico_City" = "Central Standard Time (Mexico)"
    "Europe/Amsterdam" = "W. Europe Standard Time"
    "Europe/Helsinki" = "FLE Standard Time"
    "America/Panama" = "SA Pacific Standard Time"
    "Asia/Kuala_Lumpur" = "Singapore Standard Time"
    "Asia/Jakarta" = "SE Asia Standard Time"
    "Asia/Seoul" = "Korea Standard Time"
    "Africa/Lagos" = "W. Central Africa Standard Time"
    "Africa/Johannesburg" = "South Africa Standard Time"
    "Asia/Riyadh" = "Arab Standard Time"
    "Asia/Karachi" = "Pakistan Standard Time"
    "Asia/Manila" = "Singapore Standard Time"
  }
  if (-not $map.ContainsKey($IanaId)) {
    throw "Unsupported IANA timezone mapping: $IanaId"
  }
  return $map[$IanaId]
}

function Resolve-WeatherMetarSeriesId {
  param([string] $Slug)
  $map = @{
    "newyork" = "10005"
    "london" = "10006"
    "dallas" = "10727"
    "miami" = "10728"
    "seattle" = "10734"
    "atlanta" = "10739"
    "tokyo" = "10740"
    "shanghai" = "10741"
    "toronto" = "10743"
    "buenosaires" = "10744"
    "wellington" = "10902"
    "saopaulo" = "11169"
    "lucknow" = "11271"
    "munich" = "11272"
    "telaviv" = "11295"
    "hongkong" = "11312"
    "singapore" = "11314"
    "warsaw" = "11342"
    "milan" = "11343"
    "madrid" = "11345"
    "taipei" = "11346"
    "chongqing" = "11362"
    "beijing" = "11363"
    "wuhan" = "11364"
    "chengdu" = "11365"
    "shenzhen" = "11366"
    "austin" = "11367"
    "houston" = "11369"
    "moscow" = "11426"
    "istanbul" = "11427"
    "mexicocity" = "11428"
    "amsterdam" = "11507"
    "helsinki" = "11508"
    "panamacity" = "11509"
    "kualalumpur" = "11510"
    "jakarta" = "11511"
    "seoul" = "10742"
    "capetown" = "11516"
    "guangzhou" = "11529"
    "jeddah" = "11514"
    "karachi" = "11530"
    "manila" = "11531"
  }
  if (-not $map.ContainsKey($Slug)) {
    throw "Unsupported city slug for series id mapping: $Slug"
  }
  return $map[$Slug]
}

if ($Unregister) {
  try {
    schtasks /Delete /TN $taskName /F 2>$null | Out-Null
    Write-Host "Removed task: $taskName"
  } catch {
    Write-Host "Task not found: $taskName"
  }
  exit 0
}

if (-not (Test-Path $nodePath)) {
  throw "Node executable not found: $nodePath"
}

if (-not $SkipBuild) {
  Set-Location $RepoRoot
  npm run $BuildScript
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed for $BuildScript with exit code $LASTEXITCODE"
  }
}

$indexPath = Join-Path $workingDir "index.js"
if (-not (Test-Path $indexPath)) {
  throw "Compiled index.js not found: $indexPath"
}

$cityTzId = Resolve-WindowsTimeZoneId -IanaId $CityTimeZoneIana
$seriesId = Resolve-WeatherMetarSeriesId -Slug $CitySlug
$cityTz = [System.TimeZoneInfo]::FindSystemTimeZoneById($cityTzId)
$hkTz = [System.TimeZoneInfo]::FindSystemTimeZoneById("China Standard Time")
$todayInCity = [System.TimeZoneInfo]::ConvertTime((Get-Date), $cityTz).Date
$targetTimes = @(
  @{ Hour = 13; Minute = 25 },
  @{ Hour = 14; Minute = 0  },
  @{ Hour = 14; Minute = 30 },
  @{ Hour = 15; Minute = 0 },
  @{ Hour = 15; Minute = 30 },
  @{ Hour = 16; Minute = 0 }
  @{ Hour = 16; Minute = 30 }
)
$triggerTimeValues = @()

foreach ($target in $targetTimes) {
  $cityLocal = [datetime]::SpecifyKind(
    [datetime]::new(
      $todayInCity.Year,
      $todayInCity.Month,
      $todayInCity.Day,
      $target.Hour,
      $target.Minute,
      0
    ),
    [System.DateTimeKind]::Unspecified
  )
  $utc = [System.TimeZoneInfo]::ConvertTimeToUtc($cityLocal, $cityTz)
  $hkLocal = [System.TimeZoneInfo]::ConvertTimeFromUtc($utc, $hkTz)
  $triggerTimeValues += $hkLocal
}

$triggerTimes = $triggerTimeValues |
  Sort-Object { $_.TimeOfDay } |
  ForEach-Object { $_.ToString("h:mmtt") } |
  Select-Object -Unique
$psCmd = '$env:WEATHER_METAR_SERIES_ID=''' + $seriesId + '''; & ''' + $nodePath + ''' ''index.js'''
$psArgs = "-NoProfile -ExecutionPolicy Bypass -Command " + '"' + $psCmd + '"'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs -WorkingDirectory $workingDir
$trigger = @()
foreach ($time in $triggerTimes) {
  $trigger += New-ScheduledTaskTrigger -Daily -At $time
}

$runLevel = if ($RunWithHighestPrivileges) { "Highest" } else { "Limited" }
$principal = New-ScheduledTaskPrincipal -UserId $UserName -LogonType Interactive -RunLevel $runLevel
$taskDef = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal
Register-ScheduledTask -TaskName $taskName -InputObject $taskDef -Force | Out-Null

if ($RunWhetherUserLoggedOnOrNot) {
  if ([string]::IsNullOrWhiteSpace($Password)) {
    $securePwd = Read-Host -AsSecureString "Enter password for $UserName"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
    try {
      $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
  schtasks /Change /TN $taskName /RU $UserName /RP $Password | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Credential update failed for $taskName with exit code $LASTEXITCODE"
  }
}

Write-Host "Created: $taskName"
Write-Host "City TZ: $CityTimeZoneIana ($cityTzId)"
Write-Host "SeriesID: $seriesId"
Write-Host "HK Times from city 15/16/17: $($triggerTimes -join ', ')"
