from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import base64
import io
from PIL import Image
from pydantic import BaseModel

from mainInference import run_pose_estimation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

class ImageData(BaseModel):
    image_base64: str

@app.post("/predict/")
async def predict(file: ImageData):
    try:
        base64_str = file.image_base64
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]

        image_bytes = base64.b64decode(base64_str)
        result = run_pose_estimation(image_bytes)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
