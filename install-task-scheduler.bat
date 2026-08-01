@echo off
setlocal EnableExtensions

rem Register "Yaya Print Agent" to start hidden at Windows logon.

set "KIT_ROOT=%~dp0"
set "KIT_ROOT=%KIT_ROOT:~0,-1%"
set "VBS=%KIT_ROOT%\start-print-agent-hidden.vbs"
set "TASK_NAME=Yaya Print Agent"

echo.
echo ========================================
echo   Install Task Scheduler - Yaya Print
echo ========================================
echo.

if not exist "%KIT_ROOT%\print-agent\package.json" (
  echo ERROR: print-agent folder not found next to this script.
  echo Run INSTALL TO THIS PC.bat first, or run this from the kit folder.
  pause
  exit /b 1
)

if not exist "%VBS%" (
  echo ERROR: start-print-agent-hidden.vbs not found.
  pause
  exit /b 1
)

echo Kit folder: %KIT_ROOT%
echo Task name:  %TASK_NAME%
echo.

schtasks /Create /F /TN "%TASK_NAME%" /SC ONLOGON /RL LIMITED /TR "wscript.exe \"%VBS%\"" 
if errorlevel 1 (
  echo.
  echo ERROR: Failed to create the scheduled task.
  echo Try running this batch file as Administrator.
  pause
  exit /b 1
)

echo.
echo Scheduled task created.
echo.
echo   - Starts at every Windows sign-in
echo   - Runs hidden (no black window)
echo   - Agent URL: http://127.0.0.1:17863
echo.
echo To test now:
echo   schtasks /Run /TN "%TASK_NAME%"
echo.
echo To remove later:
echo   schtasks /Delete /F /TN "%TASK_NAME%"
echo.
pause
