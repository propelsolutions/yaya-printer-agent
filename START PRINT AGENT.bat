@echo off
setlocal EnableExtensions

rem Start the Yaya print agent. Keep this window open while printing.
rem Works when run from the USB stick or from C:\YayaPrint after install.

set "ROOT=%~dp0"
set "AGENT_DIR=%ROOT%print-agent"

if not exist "%AGENT_DIR%\package.json" (
  echo.
  echo ERROR: print-agent folder not found next to this script.
  echo Expected: %AGENT_DIR%
  echo.
  pause
  exit /b 1
)

call "%~dp0resolve-node.bat" "%ROOT%"
if errorlevel 1 (
  echo.
  echo ERROR: Node.js was not found.
  echo.
  echo This kit should include a "node" folder. If yours is missing, ask IT to
  echo rebuild YayaPrintSetup, or install Node.js 22 LTS from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "%AGENT_DIR%\node_modules" (
  echo.
  echo Installing print-agent dependencies. This may take a minute...
  echo.
  pushd "%AGENT_DIR%"
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    popd
    pause
    exit /b 1
  )
  popd
)

echo.
echo ========================================
echo   Yaya Print Agent
echo ========================================
echo.
echo Keep this window open while you print.
echo Admin settings: your store URL ^> Admin ^> Settings ^> Printer
echo.
echo Listening on http://127.0.0.1:17863
echo.

pushd "%AGENT_DIR%"
call npm start
set "EXIT_CODE=%ERRORLEVEL%"
popd

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Print agent exited with an error.
  pause
  exit /b %EXIT_CODE%
)

pause
