# This file exists for PyInstaller compatibility
# PyInstaller looks for app.py by default in some configurations
# Import and run from main.py

from main import app
import sys

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    print(f"Starting LearnIT Python backend on port {port}...")
    app.run(port=port, debug=False)
