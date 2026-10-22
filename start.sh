#!/bin/bash
cd "$(dirname "$0")/backend"
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "Open http://127.0.0.1:5000"
python app.py
