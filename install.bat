@echo off
title Installing Antigravity Wallpaper Engine
cd /d "%~dp0"

echo ====================================================
echo Antigravity Wallpaper Engine Installer
echo By Vinayak Saxena (@vinayaksaxena1-maker)
echo ====================================================
echo.

:: 1. Detect Node.js
set "NODE_EXE="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if "%NODE_EXE%"=="" (
    node -v >nul 2>&1
    if "%ERRORLEVEL%"=="0" set "NODE_EXE=node"
)
if "%NODE_EXE%"=="" if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
if "%NODE_EXE%"=="" if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\node\node.exe"

if "%NODE_EXE%"=="" (
    echo [ERROR] Node.js is required! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Check Antigravity process
tasklist /FI "IMAGENAME eq Antigravity.exe" 2>NUL | find /I /N "Antigravity.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] Antigravity is currently open!
    echo It must be closed to update the app background.
    echo.
    choice /M "Do you want this script to automatically close Antigravity"
    if errorlevel 2 goto MANUALLY_CLOSED
    if errorlevel 1 (
        echo Closing Antigravity...
        taskkill /F /IM "Antigravity.exe" >nul 2>&1
        timeout /t 2 /nobreak >nul
        goto DO_INSTALL
    )
)

:MANUALLY_CLOSED
echo After manually closing Antigravity, press any key to continue...
pause

:DO_INSTALL
echo.
echo Installing Wallpaper Engine...
"%NODE_EXE%" src\installer.cjs install

if errorlevel 1 (
    echo.
    echo [FAILED] Installation could not complete. Make sure Antigravity is closed.
) else (
    echo.
    echo [SUCCESS] Successfully installed! You can now launch Antigravity.
)

echo.
pause
