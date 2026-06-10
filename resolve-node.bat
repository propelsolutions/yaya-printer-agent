@echo off
rem Resolve Node.js: prefer bundled portable Node next to this script.
set "NODE_ROOT=%~1"
set "NODE_EXE="

if exist "%NODE_ROOT%node\node.exe" (
  set "NODE_EXE=%NODE_ROOT%node\node.exe"
  set "PATH=%NODE_ROOT%node;%PATH%"
  exit /b 0
)

where node >nul 2>&1
if not errorlevel 1 (
  set "NODE_EXE=node"
  exit /b 0
)

exit /b 1
