from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from mainInference import run_pose_estimation

app = FastAPI()

@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = run_pose_estimation(image_bytes)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
