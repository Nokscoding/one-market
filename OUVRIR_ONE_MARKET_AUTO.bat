@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0AUTO_DEV.ps1"
