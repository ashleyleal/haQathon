import cv2 as cv
import numpy as np
import onnxruntime as ort

from PIL import Image
from pathlib import Path
from typing import List, Tuple
from utils import transform_numpy_opencv, keypoint_processor_numpy

# Set up
root_dir = Path.cwd()
onnx_runtime_dir = Path(ort.__file__).parent
print(f"Root directory: {root_dir} \nONNX Runtime directory: {onnx_runtime_dir}")

MODEL_PATH = "hrnet_pose-hrnetpose-float.onnx"

hexagon_driver = Path.joinpath(onnx_runtime_dir, "capi", "QnnHtp.dll")
print(f"Hexagon driver path: {hexagon_driver}")

qnn_provider_options = {
    "backend_path": hexagon_driver,
}

so = ort.SessionOptions()
so.enable_profiling = True

session = ort.InferenceSession(MODEL_PATH, 
                               providers= [("QNNExecutionProvider",qnn_provider_options),"CPUExecutionProvider"],
                               sess_options=so
                              )

session.get_providers()

input_0 = session.get_inputs()[0]
output_0 = session.get_outputs()[0]
expected_shape = input_0.shape

## Open camera
cap = cv.VideoCapture(0) # 0: System Camera

if not cap.isOpened():
    print("Invalid Camera Selected")
    exit()

###########################################################################
## This is for scaling purposes ###########################################
###########################################################################
input_image_height, input_image_width = expected_shape[2], expected_shape[3]

heatmap_height, heatmap_width = 64, 48
scaler_height = input_image_height/heatmap_height
scaler_width = input_image_width/heatmap_width

while True:

    ret, hwc_frame = cap.read()
 
    if not ret:
        print("Can't receive frame (stream end?). Exiting...")
        break

    hwc_frame_processed, chw_frame = transform_numpy_opencv(hwc_frame, expected_shape) # (3,256,192)

    ########################################################################
    ## INFERENCE ###########################################################
    ########################################################################
    inference_frame = np.expand_dims(chw_frame, axis=0) # (1,3,256,192)
    outputs = session.run(None, {input_0.name:inference_frame}) # (1,1,17,64,48)

    output_tensor = np.array(outputs).squeeze(0).squeeze(0) # (17,64,48)
    
    keypoint_coordinate_list = keypoint_processor_numpy(output_tensor, scaler_height, scaler_width)
    print(f"Keypoint coordinates: {keypoint_coordinate_list}")

    ########################################################################
    # SCALE AND MAP KEYPOINTS BACK TO ORIGINAL FRAME THEN DISPLAY THAT FRAME
    ########################################################################
    frame = (hwc_frame_processed*255).astype(np.uint8)
    frame = frame.copy()

    body_parts = [
    "nose", "left eye", "right eye", "left ear", "right ear",
    "left shoulder", "right shoulder", "left elbow", "right elbow",
    "left wrist", "right wrist", "left hip", "right hip",
    "left knee", "right knee", "left ankle", "right ankle"]

    for i, (y,x) in enumerate(keypoint_coordinate_list):
        cv.circle(frame, (x,y), radius=3, color=(0,0,255), thickness=-1)
        cv.putText(frame, body_parts[i], (x + 5, y - 5), cv.FONT_HERSHEY_SIMPLEX,
               fontScale=0.2, color=(255, 255, 255), thickness=1)
        
    frame = cv.resize(frame, (640,480), interpolation=cv.INTER_CUBIC)    
    cv.imshow('frame',frame)
    if cv.waitKey(1) == ord('q'):
        break
