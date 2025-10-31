#!/bin/bash

# LearnIT - Smart Clipboard Manager Startup Script

echo "🚀 Starting LearnIT..."

# Check if Python is installed
if ! command -v python3 &> /dev/null
then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
fi

# Activate virtual environment if it exists
if [ -d "./.venv" ]; then
    echo "🐍 Using Python virtual environment..."
    export PYTHON_PATH="../.venv/bin/python3"
else
    export PYTHON_PATH="python3"
fi

# Check Python dependencies
echo "🔍 Checking Python dependencies..."
$PYTHON_PATH -c "import flask, flask_cors, pyperclip" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing Python dependencies..."
    cd backend
    $PYTHON_PATH -m pip install -r requirements.txt
    cd ..
fi

# Start the application
echo "✨ Launching LearnIT..."
npm start
