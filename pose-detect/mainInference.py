import numpy as np
import onnxruntime as ort
from PIL import Image
import io
from pathlib import Path
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
expected_shape = input_0.shape

input_image_height, input_image_width = expected_shape[2], expected_shape[3]
heatmap_height, heatmap_width = 64, 48
scaler_height = input_image_height / heatmap_height
scaler_width = input_image_width / heatmap_width

def run_pose_estimation(image_bytes: bytes):
    # Convert bytes to image array
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    hwc_frame = np.array(image)

    # Preprocess and convert to CHW format
    hwc_frame_processed, chw_frame = transform_numpy_opencv(hwc_frame, expected_shape)
    inference_frame = np.expand_dims(chw_frame, axis=0)  # (1, 3, 256, 192)

    # Inference
    outputs = session.run(None, {input_0.name: inference_frame})  # (1, 1, 17, 64, 48)
    output_tensor = np.array(outputs).squeeze(0).squeeze(0)       # (17, 64, 48)

    # Postprocess
    keypoints = keypoint_processor_numpy(output_tensor, scaler_height, scaler_width)
    posture = check_posture(keypoints)
    return {
        "good": posture,
        # "keypoints": [tuple(map(int, pt)) for pt in keypoints]
    }

def check_posture(keypoints):
    # FIXME: Implement posture checking logic
    return True
