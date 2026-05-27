@echo off
echo =========================================================
echo  AeroSense - VOC Decay Airflow Analyzer Backend Launcher
echo =========================================================
echo.

cd /d "%~dp0"

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in system PATH.
    echo Please install Python 3.8+ and try again.
    pause
    exit /b 1
)

:: Create virtual environment if it does not exist
if not exist venv (
    echo [INFO] Creating Python virtual environment (venv)...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate

:: Install/Upgrade dependencies
echo [INFO] Checking and installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

:: Run FastAPI server
echo [INFO] Launching FastAPI WebSockets Server...
echo [INFO] Server will listen on http://127.0.0.1:8000
echo.
python main.py

pause
