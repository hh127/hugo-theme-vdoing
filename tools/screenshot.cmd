@echo off
rem Wrapper for tools/screenshot.ps1 (bypass PowerShell execution policy).
rem Usage: tools\screenshot.cmd -BuildDir .tmp/build-article -Page "/" -Port 8901 -Out .tmp/a.png
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0screenshot.ps1" %*
