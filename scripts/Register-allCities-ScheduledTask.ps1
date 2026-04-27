[CmdletBinding()]
param(
  [switch] $SkipBuild,
  [switch] $RunWhetherUserLoggedOnOrNot,
  [string] $UserName = "$env:COMPUTERNAME\$env:USERNAME",
  [string] $Password,
  [switch] $RunWithHighestPrivileges,
  [switch] $Unregister
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$cityScripts = Get-ChildItem -Path $scriptDir -Filter "Create-*-ScheduledTask.ps1" -File |
  Sort-Object Name

if ($cityScripts.Count -eq 0) {
  throw "No city scheduler scripts found in $scriptDir"
}

if ($RunWhetherUserLoggedOnOrNot -and [string]::IsNullOrWhiteSpace($Password)) {
  $securePwd = Read-Host -AsSecureString "Enter password for $UserName"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
  try {
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Write-Host "Found $($cityScripts.Count) city scripts."

foreach ($cityScript in $cityScripts) {
  Write-Host ""
  Write-Host "Running: $($cityScript.Name)"

  $invokeParams = @{
    SkipBuild = $SkipBuild
    RunWhetherUserLoggedOnOrNot = $RunWhetherUserLoggedOnOrNot
    UserName = $UserName
    Password = $Password
    RunWithHighestPrivileges = $RunWithHighestPrivileges
    Unregister = $Unregister
  }

  & $cityScript.FullName @invokeParams
}

Write-Host ""
Write-Host "Completed all city scheduler scripts."
