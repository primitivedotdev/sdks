param(
  [string]$Version = $env:PRIMITIVE_RUST_CLI_VERSION,
  [string]$Target = $env:PRIMITIVE_RUST_CLI_TARGET,
  [string]$InstallDir = $env:PRIMITIVE_RUST_CLI_INSTALL_DIR,
  [string]$Repo = $env:PRIMITIVE_RUST_CLI_REPO,
  [string]$BaseUrl = $env:PRIMITIVE_RUST_CLI_BASE_URL,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error "install-rust-cli: $Message"
  exit 1
}

function Test-WindowsHost {
  return [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
    [System.Runtime.InteropServices.OSPlatform]::Windows
  )
}

function Get-DetectedTarget {
  if (-not (Test-WindowsHost)) {
    Fail "this installer supports Windows only. Use scripts/install-rust-cli.sh on macOS or Linux."
  }

  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
  switch ($arch) {
    "X64" { return "windows-x64" }
    "Arm64" {
      Write-Warning "Windows ARM64 uses the windows-x64 archive until a native Windows ARM64 release exists."
      return "windows-x64"
    }
    default { Fail "unsupported architecture: $arch. Pass -Target to override." }
  }
}

function Join-ArchiveLocation($Base, $Leaf) {
  $trimmed = $Base.TrimEnd("/", "\")
  if ($trimmed -match "^[A-Za-z][A-Za-z0-9+.-]*://") {
    return "$trimmed/$Leaf"
  }

  return Join-Path $trimmed $Leaf
}

function Copy-OrDownload($Source, $Destination) {
  if ($Source -match "^file://") {
    $localPath = ([System.Uri]$Source).LocalPath
    Copy-Item -LiteralPath $localPath -Destination $Destination -Force
    return
  }

  if (Test-Path -LiteralPath $Source) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return
  }

  Invoke-WebRequest -Uri $Source -OutFile $Destination -UseBasicParsing
}

if (-not $Version) {
  Fail "-Version is required"
}

$Version = $Version.TrimStart("v")
if ($Version -notmatch "^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$") {
  Fail "invalid version: $Version"
}

if (-not $Target) {
  $Target = Get-DetectedTarget
}

if ($Target -ne "windows-x64") {
  Fail "unsupported target: $Target"
}

if (-not $InstallDir) {
  if (-not $HOME) {
    Fail "-InstallDir is required when HOME is unset"
  }
  $InstallDir = Join-Path $HOME ".local\bin"
}

if (-not $Repo) {
  $Repo = "primitivedotdev/sdks"
}

if (-not $BaseUrl) {
  $BaseUrl = "https://github.com/$Repo/releases/download/cli-rust-v$Version"
}

$archive = "primitive-rust-cli-v$Version-$Target.zip"
$checksum = "$archive.sha256"
$archiveUrl = Join-ArchiveLocation $BaseUrl $archive
$checksumUrl = Join-ArchiveLocation $BaseUrl $checksum

if ($DryRun) {
  Write-Output "version=$Version"
  Write-Output "target=$Target"
  Write-Output "archive_url=$archiveUrl"
  Write-Output "checksum_url=$checksumUrl"
  Write-Output "install_dir=$InstallDir"
  exit 0
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $tmpDir | Out-Null

try {
  $archivePath = Join-Path $tmpDir $archive
  $checksumPath = Join-Path $tmpDir $checksum
  Copy-OrDownload $archiveUrl $archivePath
  Copy-OrDownload $checksumUrl $checksumPath

  $checksumText = Get-Content -LiteralPath $checksumPath -Raw
  $expectedHash = ($checksumText -split "\s+")[0].ToLowerInvariant()
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) {
    Fail "checksum mismatch for $archive"
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $expectedMembers = @("primitive.exe", "prim.exe", "README.md", "LICENSE")
    $actualMembers = @($zip.Entries | ForEach-Object { $_.FullName })
    if ($actualMembers.Count -ne $expectedMembers.Count) {
      Fail "archive must contain exactly primitive.exe, prim.exe, README.md, and LICENSE"
    }
    foreach ($member in $expectedMembers) {
      if ($actualMembers -notcontains $member) {
        Fail "archive did not contain $member"
      }
    }
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName
      if ($name.StartsWith("/") -or $name.StartsWith("\") -or $name.Contains("..") -or $name.EndsWith("/") -or $name.EndsWith("\")) {
        Fail "archive contains an unsafe member path"
      }
      $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xF000
      if ($unixMode -eq 0xA000) {
        Fail "archive contains a symbolic link"
      }
    }
  } finally {
    $zip.Dispose()
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $tmpDir -Force
  $primitivePath = Join-Path $tmpDir "primitive.exe"
  $primPath = Join-Path $tmpDir "prim.exe"
  if (-not (Test-Path -LiteralPath $primitivePath)) {
    Fail "archive did not contain primitive.exe"
  }
  if (-not (Test-Path -LiteralPath $primPath)) {
    Fail "archive did not contain prim.exe"
  }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Copy-Item -LiteralPath $primitivePath -Destination (Join-Path $InstallDir "primitive.exe") -Force
  Copy-Item -LiteralPath $primPath -Destination (Join-Path $InstallDir "prim.exe") -Force

  Write-Output "Installed primitive.exe and prim.exe to $InstallDir"
  $pathEntries = [Environment]::GetEnvironmentVariable("Path", "Process") -split [IO.Path]::PathSeparator
  if ($pathEntries -notcontains $InstallDir) {
    $primitiveInstalled = Join-Path $InstallDir "primitive.exe"
    Write-Output "Add $InstallDir to PATH or run $primitiveInstalled directly."
  }
} finally {
  Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
