@echo off
setlocal EnableExtensions

rem Copy the USB kit to C:\YayaPrint and create a desktop shortcut.

set "SOURCE=%~dp0"
set "TARGET=C:\YayaPrint"

echo.
echo ========================================
echo   Install Yaya Print to this PC
echo ========================================
echo.
echo From: %SOURCE%
echo To:   %TARGET%
echo.

if not exist "%SOURCE%print-agent\package.json" (
  echo ERROR: print-agent folder not found on this USB stick.
  pause
  exit /b 1
)

if not exist "%TARGET%" mkdir "%TARGET%"

echo Copying files...
xcopy "%SOURCE%print-agent" "%TARGET%\print-agent\" /E /I /Y /Q
if errorlevel 1 (
  echo ERROR: Copy failed.
  pause
  exit /b 1
)

if exist "%SOURCE%node\" (
  echo Copying portable Node.js...
  xcopy "%SOURCE%node" "%TARGET%\node\" /E /I /Y /Q
  if errorlevel 1 (
    echo ERROR: Failed to copy Node.js folder.
    pause
    exit /b 1
  )
)

copy /Y "%SOURCE%resolve-node.bat" "%TARGET%\resolve-node.bat" >nul 2>nul
if exist "%SOURCE%start-print-agent-hidden.vbs" (
  copy /Y "%SOURCE%start-print-agent-hidden.vbs" "%TARGET%\start-print-agent-hidden.vbs" >nul
)
if exist "%SOURCE%install-task-scheduler.bat" (
  copy /Y "%SOURCE%install-task-scheduler.bat" "%TARGET%\install-task-scheduler.bat" >nul
)
if exist "%SOURCE%START PRINT AGENT.bat" (
  copy /Y "%SOURCE%START PRINT AGENT.bat" "%TARGET%\start-print-agent.bat" >nul
) else (
  copy /Y "%SOURCE%start-print-agent.bat" "%TARGET%\start-print-agent.bat" >nul
)
copy /Y "%SOURCE%WAREHOUSE-STAFF.txt" "%TARGET%\WAREHOUSE-STAFF.txt" >nul 2>nul

echo Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; ^
   $Shortcut = $WshShell.CreateShortcut($WshShell.SpecialFolders('Desktop') + '\Yaya Print Agent.lnk'); ^
   $Shortcut.TargetPath = '%TARGET%\start-print-agent.bat'; ^
   $Shortcut.WorkingDirectory = '%TARGET%'; ^
   $Shortcut.Description = 'Start Yaya label printer agent'; ^
   $Shortcut.Save()"

echo.
echo Done. Files are in %TARGET%
echo A shortcut was added to the desktop: "Yaya Print Agent"
echo.
echo Next:
echo   1. Plug in the label printer
echo   2. Double-click "Yaya Print Agent" on the desktop
echo   3. Optional: run install-task-scheduler.bat for auto-start at login
echo   4. Open admin ^> Settings ^> Printer and run a test label
echo.
pause
