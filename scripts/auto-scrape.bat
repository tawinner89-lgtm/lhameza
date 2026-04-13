@echo off
:: L'HAMZA F SEL'A - Full Scraping Pipeline
:: Double-click OR run via Windows Task Scheduler (every 6h)

set PROJECT_DIR=C:\Users\dell\Desktop\centre data
set NODE_EXE=C:\Program Files\nodejs\node.exe
set LOGS_DIR=%PROJECT_DIR%\logs

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DAY=%%a & set MONTH=%%b & set YEAR=%%c)
for /f "tokens=1 delims=: " %%a in ('time /t') do set HOUR=%%a
if "%HOUR:~1,1%"=="" set HOUR=0%HOUR%
set LOG_FILE=%LOGS_DIR%\scrape-%YEAR%-%MONTH%-%DAY%-%HOUR%.log

cd /d "%PROJECT_DIR%"

echo [%date% %time%] === L'HAMZA Scraping Pipeline === >> "%LOG_FILE%"

:: [1] All adapters via ci-scrape (parallel batches)
echo [%date% %time%] [1/3] All adapters... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\ci-scrape.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [1/3] Done >> "%LOG_FILE%"

:: [2] Zara standalone (Playwright visible mode)
echo [%date% %time%] [2/3] Zara... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-zara.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [2/3] Done >> "%LOG_FILE%"

:: [3] Post best deals to Telegram
echo [%date% %time%] [3/3] Posting to Telegram... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\auto-post-deals.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [3/3] Done >> "%LOG_FILE%"

echo [%date% %time%] === Pipeline complete === >> "%LOG_FILE%"
echo Done! Log saved: %LOG_FILE%
pause
