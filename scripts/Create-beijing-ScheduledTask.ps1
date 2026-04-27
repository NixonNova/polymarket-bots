[CmdletBinding()]
param(
  [switch] $SkipBuild,
  [switch] $RunWhetherUserLoggedOnOrNot,
  [string] $UserName = "$env:COMPUTERNAME\$env:USERNAME",
  [string] $Password,
  [switch] $RunWithHighestPrivileges,
  [switch] $Unregister
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$params = @{
  CitySlug = 'beijing'
  BuildScript = 'build:weatherByMetar:beijing'
  OutDir = 'dist/polymarket-weatherByMetarBeijing-bots'
  CityTimeZoneIana = 'Asia/Shanghai'
  SkipBuild = $SkipBuild
  RunWhetherUserLoggedOnOrNot = $RunWhetherUserLoggedOnOrNot
  UserName = $UserName
  Password = $Password
  RunWithHighestPrivileges = $RunWithHighestPrivileges
  Unregister = $Unregister
}

& (Join-Path $scriptDir "Register-city-ScheduledTask.ps1") @params


