@echo off
echo === Building Iris Anticheat (Tauri) ===
echo.

REM Check if Rust is installed
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Rust is not installed!
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

echo [1/5] Checking Tauri CLI...
cargo tauri --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing Tauri CLI...
    cargo install tauri-cli
)

echo [2/5] Building release version...
cargo tauri build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo [3/5] Locating binary...
set BINARY_PATH=target\release\iris-anticheat.exe
if not exist %BINARY_PATH% (
    set BINARY_PATH=target\release\Iris.exe
)

echo [4/5] Applying UPX compression (optional)...
where upx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    upx --best --lzma %BINARY_PATH%
    echo UPX compression applied!
) else (
    echo UPX not found - skipping compression
    echo To install: winget install upx.upx
)

echo [5/5] Done!
echo.
echo === Build Complete! ===
echo Binary: %BINARY_PATH%
echo Installer: target\release\bundle\nsis\

for %%I in (%BINARY_PATH%) do echo Size: %%~zI bytes

echo.
pause
