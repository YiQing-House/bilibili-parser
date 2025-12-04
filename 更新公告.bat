@echo off
chcp 65001 >nul
echo ========================================
echo    自动更新云公告
echo ========================================
echo.

REM 检查是否设置了 GITHUB_TOKEN
if "%GITHUB_TOKEN%"=="" (
    echo [错误] 未设置 GITHUB_TOKEN 环境变量
    echo.
    echo 设置方法：
    echo 1. 访问: https://github.com/settings/tokens
    echo 2. 生成新的 token，勾选 "gist" 权限
    echo 3. 在 PowerShell 中运行：
    echo    $env:GITHUB_TOKEN="your_token_here"
    echo.
    echo 或者在当前会话中临时设置：
    set /p GITHUB_TOKEN="请输入你的 GitHub Token: "
    if "!GITHUB_TOKEN!"=="" (
        echo [错误] Token 不能为空
        pause
        exit /b 1
    )
)

echo [信息] 正在更新公告...
echo.

REM 检查是否有自定义消息
if "%1"=="" (
    REM 使用最新的 commit 信息
    node update-announcement.js
) else (
    REM 使用自定义消息
    node update-announcement.js "%1"
)

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    ✅ 公告更新成功！
    echo ========================================
    echo.
    echo 用户下次打开网站时会看到更新内容
) else (
    echo.
    echo ========================================
    echo    ❌ 公告更新失败
    echo ========================================
    echo.
    echo 请检查：
    echo 1. GITHUB_TOKEN 是否正确
    echo 2. Token 是否有 gist 权限
    echo 3. 网络连接是否正常
)

echo.
pause

