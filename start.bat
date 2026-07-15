@echo off
setlocal

cd /d "%~dp0"

echo [NanKe] Checking runtime...
where node >nul 2>nul
if errorlevel 1 (
    echo [NanKe] Node.js was not found.
    echo [NanKe] Please install Node.js and run this script again.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    where corepack >nul 2>nul
    if errorlevel 1 (
        echo [NanKe] pnpm and Corepack were not found.
        echo [NanKe] Please install pnpm 11.5.1 and run this script again.
        pause
        exit /b 1
    )

    echo [NanKe] Enabling pnpm 11.5.1...
    call corepack prepare pnpm@11.5.1 --activate
    if errorlevel 1 (
        echo [NanKe] Failed to enable pnpm.
        pause
        exit /b 1
    )
)

echo [NanKe] Installing dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
    echo [NanKe] Dependency installation failed.
    pause
    exit /b 1
)

echo [NanKe] Building production application...
call pnpm build
if errorlevel 1 (
    echo [NanKe] Production build failed.
    pause
    exit /b 1
)

echo [NanKe] Starting http://127.0.0.1:5173 ...
call pnpm start

if errorlevel 1 (
    echo [NanKe] The server stopped unexpectedly.
    pause
    exit /b 1
)

endlocal
