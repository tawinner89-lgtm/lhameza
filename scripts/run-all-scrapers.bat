@echo off
title L'HAMZA - Full Scrape (All Sources)
set PROJECT_DIR=C:\Users\dell\Desktop\centre data
set NODE_EXE=C:\Program Files\nodejs\node.exe

echo ============================================
echo  L'HAMZA - Running ALL Scrapers
echo  %date% %time%
echo ============================================

cd /d "%PROJECT_DIR%"

:: ─────────────────────────────────────────────
:: [1/6] Reliable adapters in parallel
::   Jumia (all categories) + Electroplanet +
::   Marjane, Kitea, BIM, Hmizate, Hmall,
::   Cosmetique, YvesRocher, UltraPC, AliExpress
:: ─────────────────────────────────────────────
echo.
echo [1/6] Reliable adapters (Jumia + Electroplanet + Home + Beauty + Tech)...
"%NODE_EXE%" scripts\ci-scrape.js --adapters jumia_tech,jumia_fashion,jumia_home,jumia_beauty,jumia_brands,electroplanet,marjane,kitea,bim,hmizate,hmizate_beauty,hmall,cosmetique,yvesrocher,ultrapc,aliexpress
if errorlevel 1 echo [WARN] Some reliable adapters failed, continuing...

:: ─────────────────────────────────────────────
:: [2/6] Zara Morocco
:: ─────────────────────────────────────────────
echo.
echo [2/6] Zara Morocco...
"%NODE_EXE%" scripts\scrape-zara.js
if errorlevel 1 echo [WARN] Zara scraper failed, continuing...

:: ─────────────────────────────────────────────
:: [3/6] Nike
:: ─────────────────────────────────────────────
echo.
echo [3/6] Nike...
"%NODE_EXE%" scripts\scrape-nike.js
if errorlevel 1 echo [WARN] Nike scraper failed, continuing...

:: ─────────────────────────────────────────────
:: [4/6] Adidas
:: ─────────────────────────────────────────────
echo.
echo [4/6] Adidas...
"%NODE_EXE%" scripts\scrape-adidas.js
if errorlevel 1 echo [WARN] Adidas scraper failed, continuing...

:: ─────────────────────────────────────────────
:: [5/6] Bershka + Pull&Bear
:: ─────────────────────────────────────────────
echo.
echo [5/6] Bershka...
"%NODE_EXE%" scripts\scrape-bershka.js
if errorlevel 1 echo [WARN] Bershka scraper failed, continuing...

echo.
echo [5/6] Pull^&Bear...
"%NODE_EXE%" scripts\scrape-pullbear.js
if errorlevel 1 echo [WARN] Pull^&Bear scraper failed, continuing...

:: ─────────────────────────────────────────────
:: [6/6] Decathlon + Electroplanet (individual)
:: ─────────────────────────────────────────────
echo.
echo [6/6] Decathlon...
"%NODE_EXE%" scripts\scrape-decathlon.js
if errorlevel 1 echo [WARN] Decathlon scraper failed, continuing...

echo.
echo [6/6] Electroplanet...
"%NODE_EXE%" scripts\scrape-electroplanet.js
if errorlevel 1 echo [WARN] Electroplanet scraper failed, continuing...

:: ─────────────────────────────────────────────
:: Post best deals to Telegram
:: ─────────────────────────────────────────────
echo.
echo ============================================
echo  Posting best deals to Telegram...
echo ============================================
"%NODE_EXE%" scripts\auto-post-deals.js
if errorlevel 1 echo [WARN] Telegram posting failed.

:: ─────────────────────────────────────────────
echo.
echo ============================================
echo  ALL DONE! %date% %time%
echo  Press any key to close.
echo ============================================
pause
