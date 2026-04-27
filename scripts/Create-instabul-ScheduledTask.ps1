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
  CitySlug = 'istanbul'
  BuildScript = 'build:weatherByMetar:istanbul'
  OutDir = 'dist/polymarket-weatherByMetarIstanbul-bots'
  CityTimeZoneIana = 'Europe/Istanbul'
  SkipBuild = $SkipBuild
  RunWhetherUserLoggedOnOrNot = $RunWhetherUserLoggedOnOrNot
  UserName = $UserName
  Password = $Password
  RunWithHighestPrivileges = $RunWithHighestPrivileges
  Unregister = $Unregister
}

& (Join-Path $scriptDir "Register-city-ScheduledTask.ps1") @params


