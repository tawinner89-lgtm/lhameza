@echo off
echo Creating daily Telegram stats task...

schtasks /create /tn "LHamza Daily Stats" /tr "node \"C:\Users\dell\Desktop\centre data\scripts\telegram-stats.js\"" /sc daily /st 00:00 /f

echo.
echo ✅ Task created! Will run every day at midnight (00:00)
echo.
echo To test now, run: node scripts/telegram-stats.js
echo To delete task: schtasks /delete /tn "LHamza Daily Stats" /f
pause
