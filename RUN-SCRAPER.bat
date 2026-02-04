@echo off
echo.
echo ========================================
echo   L'HAMZA F SEL'A - Run Scraper
echo ========================================
echo.

cd /d "%~dp0"
node scripts/daily-scrape.js

echo.
echo ========================================
echo   Scraping Complete!
echo   Press any key to close...
echo ========================================
pause > nul
