# Bad Posture Detector 9000

## Setup

### Frontend
Run 
```
cd frontend
npm run dev
```
Go to http://localhost:3000

### Backend
Download `hrnet_pose-hrnetpose-float.onnx` from here: https://aihub.qualcomm.com/compute/models/hrnet_pose and put it in pose-detect
> Choose ONNX Runtime > float

Install dependencies

Run
```
cd pose-detect
fastapi dev backend.py
```

