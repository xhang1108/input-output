@echo off
title Calctopus Dev Loader
cd /d %~dp0
echo [Calctopus] Checking environment and starting service...
npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Startup Failed: Another instance of Calctopus might be running.
    pause
)
