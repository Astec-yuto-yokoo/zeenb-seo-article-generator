@echo off
chcp 65001 >nul 2>&1
title SEO Content Generator - 停止

echo ========================================
echo   SEO Content Generator を停止します
echo ========================================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5180 " ^| findstr "LISTENING"') do (
    echo ポート5180のプロセスを停止中...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003 " ^| findstr "LISTENING"') do (
    echo ポート3003のプロセスを停止中...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5181 " ^| findstr "LISTENING"') do (
    echo ポート5181のプロセスを停止中...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo 全サーバーを停止しました
echo.
pause
