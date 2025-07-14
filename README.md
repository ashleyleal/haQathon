# Bad Posture Detector 9000
Poor posture in the workplace can lead to chronic pain, decreased productivity, and long-term health issues. Implementing reminders for proper posture is crucial to enhance employee well-being, reduce discomfort, and improve overall efficiency. The app is designed to detect poor posture using a pose detecting neural network and provide immediate feedback to the user. When it identifies slouching or improper alignment, it sounds an alarm and sends a notification through a sleek, user-friendly interface. This real-time alert system encourages users to correct their posture instantly, helping to prevent discomfort and long-term health issues. As well, proper posture is rewarded with a green background, giving positive reinforcement to improve posture techniques.

## Team
Made by:
- Thomas Lascaud, tlascaud@qti.qualcomm.com
- Ashley Nicole Leal, aleal@qti.qualcomm.com
- Lucie Yang, luciyang@qti.qualcomm.com
- Laura Lin, laurlin@qti.qualcomm.com
- Keshavadithya Subramanya, keshavad@qti.qualcomm.com


## Setup

### Backend
Download `hrnet_pose-hrnetpose-float.onnx` from here: https://aihub.qualcomm.com/compute/models/hrnet_pose and put it in pose-detect
> Choose ONNX Runtime > float

Install dependencies

Run
```
cd pose-detect
fastapi dev backend.py
```

### Frontend
Run 
```
cd frontend
npm run dev
```
Go to http://localhost:3000


