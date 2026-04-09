@echo off
:: L'HAMZA F SEL'A - Automated Scraping Pipeline
:: Runs twice daily via Windows Task Scheduler

set PROJECT_DIR=C:\Users\dell\Desktop\centre data
set NODE_EXE=C:\Program Files\nodejs\node.exe
set LOGS_DIR=%PROJECT_DIR%\logs

:: Create logs directory if it doesn't exist
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

:: Build log filename: scrape-YYYY-MM-DD-HH.log
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (
    set DAY=%%a
    set MONTH=%%b
    set YEAR=%%c
)
for /f "tokens=1 delims=: " %%a in ('time /t') do set HOUR=%%a

:: Pad hour with leading zero if needed
if "%HOUR:~1,1%"=="" set HOUR=0%HOUR%

set LOG_FILE=%LOGS_DIR%\scrape-%YEAR%-%MONTH%-%DAY%-%HOUR%.log

:: Run the scraper, redirect output to log file
cd /d "%PROJECT_DIR%"

echo [%date% %time%] Starting scraping pipeline >> "%LOG_FILE%"
"%NODE_EXE%" scripts\ci-scrape.js --adapters reliable >> "%LOG_FILE%" 2>&1
echo [%date% %time%] Scraping pipeline finished >> "%LOG_FILE%"

echo [%date% %time%] Posting new deals to Telegram >> "%LOG_FILE%"
"%NODE_EXE%" scripts\auto-post-deals.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] Telegram posting finished >> "%LOG_FILE%"
