@echo off
setlocal
title LexiLoop - Web va Database
pushd "%~dp0"
if not "%errorlevel%"=="0" goto directory_error

if not exist "package.json" goto missing_project
if not exist "backend\package.json" goto missing_project
if not exist "frontend\package.json" goto missing_project
if not exist ".env.example" goto missing_project

echo ========================================
echo     LexiLoop - Web va Database SQLite
echo ========================================
echo.

where node >nul 2>nul
if not "%errorlevel%"=="0" goto missing_node
where npm.cmd >nul 2>nul
if not "%errorlevel%"=="0" goto missing_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if not "%errorlevel%"=="0" goto missing_node

if not exist "node_modules\.bin\concurrently.cmd" goto install
if not exist "node_modules\.bin\tsx.cmd" goto install
if not exist "node_modules\.bin\vite.cmd" goto install
if not exist "node_modules\.bin\tsc.cmd" goto install
goto configure

:install
echo Dang cai thu vien. Lan dau can ket noi Internet...
call npm.cmd install
if not "%errorlevel%"=="0" goto failed

:configure
if exist "backend\.env" goto build
echo Dang tao cau hinh backend...
node -e "const fs=require('fs'); const secret=require('crypto').randomBytes(32).toString('hex'); const template=fs.readFileSync('.env.example','utf8'); fs.writeFileSync('backend/.env',template.replace(/^AUTH_TOKEN_SECRET=.*$/m,'AUTH_TOKEN_SECRET='+secret),{flag:'wx'});"
if not "%errorlevel%"=="0" goto failed

:build
echo Dang chuan bi ung dung...
call npm.cmd run build
if not "%errorlevel%"=="0" goto failed

rem Vite opens Edge once the frontend server is listening.
set "BROWSER=msedge"
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "BROWSER_ARGS="

echo.
echo Web: http://localhost:5173
echo Microsoft Edge se tu mo khi web san sang.
echo Database SQLite se tu mo va cap nhat khi backend khoi dong.
echo Giu cua so nay mo trong khi su dung web.
echo De dung web va database: nhan Ctrl+C, chon Y neu duoc hoi.
echo.
call "node_modules\.bin\concurrently.cmd" --kill-others -n backend,frontend -c green,cyan "npm.cmd run dev -w @lexiloop/backend" "npm.cmd run dev -w @lexiloop/frontend -- --open --strictPort"
if not "%errorlevel%"=="0" goto failed
popd
exit /b 0

:missing_project
echo Khong tim thay du an trong thu muc nay.
echo Hay giu Chay-Web.bat trong thu muc du an.
echo De chay tu Desktop, tao shortcut toi file nay thay vi copy file.
goto failed

:missing_node
echo Can cai Node.js LTS phien ban 20 tro len, kem npm.
echo Tai tai https://nodejs.org/ roi bam lai file nay.
goto failed

:directory_error
echo Khong the mo thu muc du an.
pause
exit /b 1

:failed
echo.
echo Khong the chay web. Xem thong bao loi phia tren.
echo Neu cong 3001 hoac 5173 dang duoc su dung, hay dung phien web cu.
pause
popd
exit /b 1
