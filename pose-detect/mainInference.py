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
    """
    Check sitting posture based on visible keypoints.
    Returns (is_good_posture: bool, flags: List[str])
    """

    import numpy as np

    get = lambda part: np.array(keypoints[keypoints[part]])
    safe_get = lambda part: np.array(keypoints[part]) if part in keypoints else None

    # Required keypoints
    left_shoulder, right_shoulder = get("left_shoulder"), get("right_shoulder")
    left_hip, right_hip = get("left_hip"), get("right_hip")
    left_ear, right_ear = get("left_ear"), get("right_ear")
    left_elbow, right_elbow = get("left_elbow"), get("right_elbow")
    left_wrist, right_wrist = get("left_wrist"), get("right_wrist")

    # Optional keypoints
    nose = safe_get("nose")
    left_eye, right_eye = safe_get("left_eye"), safe_get("right_eye")
    left_knee, right_knee = safe_get("left_knee"), safe_get("right_knee")

    # Midpoints and distances
    mid_shoulder = (left_shoulder + right_shoulder) / 2
    mid_hip = (left_hip + right_hip) / 2
    shoulder_width = np.linalg.norm(right_shoulder - left_shoulder)

    flags = []

    # 1. Forward Head Posture 
    if nose is not None:
        nose_offset = nose[0] - mid_shoulder[0]
        if nose_offset > 0.25 * shoulder_width:
            flags.append("forward head posture (nose)")
    else:
        left_ear_offset = left_ear[0] - left_shoulder[0]
        right_ear_offset = right_ear[0] - right_shoulder[0]
        if left_ear_offset > 0.25 * shoulder_width or right_ear_offset > 0.25 * shoulder_width:
            flags.append("forward head posture (ears)")

    # 2. Uneven Shoulders
    shoulder_height_diff = abs(left_shoulder[1] - right_shoulder[1])
    if shoulder_height_diff > 0.10 * shoulder_width:
        flags.append("uneven shoulders")

    # 3. Slouching
    avg_shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
    avg_hip_y = (left_hip[1] + right_hip[1]) / 2
    if avg_shoulder_y - avg_hip_y > 0.25 * shoulder_width:
        flags.append("slouching")

    # 4. Lateral Lean
    lateral_shift = abs(mid_shoulder[0] - mid_hip[0])
    if lateral_shift > 0.15 * shoulder_width:
        flags.append("leaning to one side")

    # 5. Hunched Back / Rolled Shoulders
    if (left_elbow[0] < left_shoulder[0] - 0.2 * shoulder_width or
        right_elbow[0] > right_shoulder[0] + 0.2 * shoulder_width):
        flags.append("hunched back or rolled shoulders")

    # 6. Elevated Shoulders
    left_shoulder_ear_dist = abs(left_shoulder[1] - left_ear[1])
    right_shoulder_ear_dist = abs(right_shoulder[1] - right_ear[1])
    if left_shoulder_ear_dist < 0.1 * shoulder_width or right_shoulder_ear_dist < 0.1 * shoulder_width:
        flags.append("elevated shoulders")

    # 7. Asymmetrical Arms
    wrist_height_diff = abs(left_wrist[1] - right_wrist[1])
    if wrist_height_diff > 0.15 * shoulder_width:
        flags.append("asymmetrical arm positioning")

    # 8. Elbows Too Far Out (Winged Elbows)
    elbow_span = np.linalg.norm(left_elbow - right_elbow)
    if elbow_span > 1.5 * shoulder_width:
        flags.append("elbows flared out (winged)")

    # 9. Collapsed Upper Body
    torso_length = abs(avg_shoulder_y - avg_hip_y)
    if torso_length < 0.4 * shoulder_width:
        flags.append("collapsed upper body")

    # 10. Head Tilt
    if left_eye is not None and right_eye is not None:
        eye_height_diff = abs(left_eye[1] - right_eye[1])
        if eye_height_diff > 0.05 * shoulder_width:
            flags.append("head tilted to one side")

    # 11. Reclined Sitting Posture
    if left_knee is not None and right_knee is not None:
        avg_knee_y = (left_knee[1] + right_knee[1]) / 2
        if avg_hip_y > avg_knee_y:  # hips lower than knees = likely reclined
            flags.append("reclined or slumped sitting position")

    return len(flags) == 0
    # return flags if flags else True
    # can also return flags to indicate specific issues
    #return len(flags) == 0, flags if flags else None
