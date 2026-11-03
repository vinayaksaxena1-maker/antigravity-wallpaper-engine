@echo off
title Restoring Original Antigravity
cd /d "%~dp0"

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

"%NODE_EXE%" src\installer.cjs restore
pause
