@echo off
REM LearnIT - Smart Clipboard Manager Startup Script for Windows

echo Starting LearnIT...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python 3.8+ first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo Installing Node.js dependencies...
    set NODE_TLS_REJECT_UNAUTHORIZED=0
    call npm install
)

REM Check Python dependencies
echo Checking Python dependencies...
python -c "import flask, flask_cors, pyperclip" >nul 2>&1
if errorlevel 1 (
    echo Installing Python dependencies...
    cd backend
    python -m pip install -r requirements.txt
    cd ..
)

REM Start the application
echo Launching LearnIT...
call npm start
