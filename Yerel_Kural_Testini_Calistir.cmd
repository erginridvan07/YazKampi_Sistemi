@echo off
setlocal
title Gaye Vakfi Portal - Yerel Firestore Kural Testi

cd /d "%~dp0"

rem Bu dosya yalnizca yerel Firestore Emulator testini calistirir.
rem Canli Firebase projesine, Hosting'e veya veriye baglanmaz.
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo Java 21 bulunamadi:
  echo %JAVA_HOME%
  echo Lutfen Java 21 kurulumunu kontrol edin.
  echo.
  pause
  exit /b 1
)

set "PATH=%JAVA_HOME%\bin;%PATH%"
echo.
echo Yerel Firestore kural testi baslatiliyor...
echo Bu islem canli Firebase verisine dokunmaz.
echo.
call npm.cmd run test:rules

echo.
if errorlevel 1 (
  echo TEST BASARISIZ. Bu penceredeki sonucu kapatmadan bana bildirin.
) else (
  echo TEST BASARILI. Bu penceredeki sonucu kapatmadan bana bildirin.
)
echo.
pause
exit /b
