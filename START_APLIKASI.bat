@echo off
title WIP Tracking Konveksi & Jersey
color 0b
echo ========================================================
echo   MENJALANKAN SERVER WIP TRACKING PRODUKSI KONVEKSI
echo ========================================================
echo.
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan di PATH.
    echo Mencoba menjalankan dari folder portable...
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        "%LOCALAPPDATA%\Programs\nodejs\node.exe" server.js
    ) else (
        echo Silakan pasang Node.js terlebih dahulu.
        pause
    )
) else (
    node server.js
)

pause

