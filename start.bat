@echo off
cd /d "%~dp0backend"
set PY=python
where python >nul 2>nul || set PY=py
if not exist venv (%PY% -m venv venv)
call venv\Scripts\activate
pip install -r requirements.txt
start "" http://127.0.0.1:5000
python app.py
pause
