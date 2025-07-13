@echo off
REM Create virtual environment
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate

REM Upgrade pip
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --upgrade pip

REM Install dependencies
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn python-multipart opencv-python-headless numpy onnxruntime pillow
REM Launch FastAPI server
@REM uvicorn main:app --reload