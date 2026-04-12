@echo off
:: L'HAMZA F SEL'A - Automated Scraping Pipeline
:: Runs via Windows Task Scheduler (every 6h)
:: Mirrors run-all-scrapers.bat but logs everything to a file

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

cd /d "%PROJECT_DIR%"

echo [%date% %time%] ============================================ >> "%LOG_FILE%"
echo [%date% %time%] Starting full scraping pipeline >> "%LOG_FILE%"
echo [%date% %time%] ============================================ >> "%LOG_FILE%"

:: [1] Reliable adapters in parallel (Jumia + Electroplanet + Home + Beauty + Tech)
echo [%date% %time%] [1/6] Reliable adapters (parallel)... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\ci-scrape.js --adapters jumia_tech,jumia_fashion,jumia_home,jumia_beauty,jumia_brands,electroplanet,marjane,kitea,bim,hmizate,hmizate_beauty,hmall,cosmetique,yvesrocher,ultrapc,aliexpress >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [1/6] Done >> "%LOG_FILE%"

:: [2] Zara Morocco
echo [%date% %time%] [2/6] Zara... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-zara.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [2/6] Done >> "%LOG_FILE%"

:: [3] Nike
echo [%date% %time%] [3/6] Nike... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-nike.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [3/6] Done >> "%LOG_FILE%"

:: [4] Adidas
echo [%date% %time%] [4/6] Adidas... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-adidas.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [4/6] Done >> "%LOG_FILE%"

:: [5] Bershka + Pull&Bear
echo [%date% %time%] [5/6] Bershka + Pull^&Bear... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-bershka.js >> "%LOG_FILE%" 2>&1
"%NODE_EXE%" scripts\scrape-pullbear.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [5/6] Done >> "%LOG_FILE%"

:: [6] Decathlon + Electroplanet
echo [%date% %time%] [6/6] Decathlon + Electroplanet... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\scrape-decathlon.js >> "%LOG_FILE%" 2>&1
"%NODE_EXE%" scripts\scrape-electroplanet.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] [6/6] Done >> "%LOG_FILE%"

:: Post best deals to Telegram
echo [%date% %time%] Posting new deals to Telegram... >> "%LOG_FILE%"
"%NODE_EXE%" scripts\auto-post-deals.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] Telegram posting finished >> "%LOG_FILE%"

echo [%date% %time%] ============================================ >> "%LOG_FILE%"
echo [%date% %time%] Pipeline complete >> "%LOG_FILE%"
echo [%date% %time%] ============================================ >> "%LOG_FILE%"
