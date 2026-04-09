@echo off
:: L'HAMZA F SEL'A - Manual Scrape Trigger
:: Double-click to run the full scraping pipeline NOW

set PROJECT_DIR=C:\Users\dell\Desktop\centre data
set NODE_EXE=C:\Program Files\nodejs\node.exe

title L'HAMZA - Scraping Pipeline

echo.
echo ============================================
echo  L'HAMZA F SEL'A - Manual Scrape
echo  %date% %time%
echo ============================================
echo.

cd /d "%PROJECT_DIR%"

"%NODE_EXE%" scripts\ci-scrape.js --adapters reliable

echo.
echo ============================================
echo  Done! Press any key to close.
echo ============================================
pause
