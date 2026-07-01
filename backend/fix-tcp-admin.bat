@echo off
powershell -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File \"%~dp0fix-sqlexpress-tcp.ps1\"' -Verb RunAs -Wait"
echo Done. Press any key to close.
pause >nul
