@echo off
:: L'HAMZA F SEL'A - Windows Task Scheduler Setup
:: Creates two daily scraping tasks: 08:00 and 20:00

set PROJECT_DIR=C:\Users\dell\Desktop\centre data
set SCRIPT=%PROJECT_DIR%\scripts\auto-scrape.bat

echo.
echo ============================================
echo  L'HAMZA F SEL'A - Scraping Scheduler Setup
echo ============================================
echo.

:: Delete existing tasks if they exist (ignore errors)
schtasks /delete /tn "LHamza-Scrape-Morning" /f >nul 2>&1
schtasks /delete /tn "LHamza-Scrape-Evening" /f >nul 2>&1

:: Create morning task - 08:00
schtasks /create ^
  /tn "LHamza-Scrape-Morning" ^
  /tr "\"%SCRIPT%\"" ^
  /sc daily ^
  /st 08:00 ^
  /rl highest ^
  /f

if %errorlevel% equ 0 (
    echo [OK] Morning task created: 08:00 daily
) else (
    echo [FAIL] Morning task creation failed. Try running as Administrator.
)

:: Create evening task - 20:00
schtasks /create ^
  /tn "LHamza-Scrape-Evening" ^
  /tr "\"%SCRIPT%\"" ^
  /sc daily ^
  /st 20:00 ^
  /rl highest ^
  /f

if %errorlevel% equ 0 (
    echo [OK] Evening task created: 20:00 daily
) else (
    echo [FAIL] Evening task creation failed. Try running as Administrator.
)

echo.
echo ============================================
echo  Tasks registered:
echo    LHamza-Scrape-Morning  ->  08:00 daily
echo    LHamza-Scrape-Evening  ->  20:00 daily
echo.
echo  Logs will be saved to:
echo    %PROJECT_DIR%\logs\
echo.
echo  Useful commands:
echo    View tasks  : schtasks /query /tn "LHamza-Scrape-Morning"
echo    Run now     : schtasks /run /tn "LHamza-Scrape-Morning"
echo    Delete all  : schtasks /delete /tn "LHamza-Scrape-Morning" /f
echo                  schtasks /delete /tn "LHamza-Scrape-Evening" /f
echo.
echo  NOTE: For tasks to run when logged out, open Task Scheduler,
echo  edit each task, and set "Run whether user is logged on or not"
echo  then enter your Windows password.
echo ============================================
echo.
pause
