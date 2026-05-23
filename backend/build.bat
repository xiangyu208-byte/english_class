@echo off
chcp 65001 >nul
echo ================================================
echo   Lexical Sanctuary - Backend Build Script
echo ================================================

REM 创建 build 目录
if not exist build mkdir build
cd build

REM 快速编译选项：若系统包含 g++，尝试直接用 g++ 编译单文件后端（适合 MinGW / WSL）
echo [0/2] Trying quick g++ build...
where g++ >nul 2>&1
if %errorlevel% EQU 0 (
    echo Found g++, building with g++...
    cd ..
    g++ -std=c++17 -O2 -Iinclude server.cpp -o lexical_backend.exe -lws2_32
    if %errorlevel% EQU 0 (
        echo Build successful (g++)
        echo Run: .\backend\lexical_backend.exe
        pause
        exit /b 0
    ) else (
        echo g++ build failed, continuing with CMake flow...
    )
    cd build
)

REM 使用 CMake 配置项目
echo [1/2] Configuring with CMake...
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo.
    echo [!] MinGW not found, trying MSVC...
    cmake .. -DCMAKE_BUILD_TYPE=Release
    if %errorlevel% neq 0 (
        echo [ERROR] CMake configuration failed!
        echo Please install CMake and a C++ compiler (MinGW-w64 or Visual Studio).
        pause
        exit /b 1
    )
)

REM 编译
echo [2/2] Building...
cmake --build . --config Release
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Build successful!
echo   Run: cd build ^&^& lexical_sanctuary_backend.exe
echo ================================================

cd ..
pause
