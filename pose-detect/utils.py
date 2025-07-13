import cv2 as cv
import numpy as np

from typing import List, Tuple

def transform_numpy_opencv(image: np.ndarray, 
                           expected_shape
                          ) -> Tuple[np.ndarray, np.ndarray]:
    """
    Resize and normalize an image using OpenCV, and return both HWC and CHW formats.

    Parameters:
    -----------
    image : np.ndarray
        Input image in HWC (Height, Width, Channels) format with dtype uint8.
    
    expected_shape : tuple or list
        Expected shape of the model input, typically in the format (N, C, H, W).
        Only the height and width (H, W) are used for resizing.

    Returns:
    --------
    tuple of np.ndarray
        - float_image: The resized and normalized image in HWC format (float32, range [0, 1]).
        - chw_image: The same image converted to CHW format, suitable for deep learning models.
    """
    
    height, width = expected_shape[2], expected_shape[3]
    resized_image = cv.resize(image, (width, height), interpolation=cv.INTER_CUBIC)
    float_image = resized_image.astype(np.float32) / 255.0
    chw_image = np.transpose(float_image, (2,0,1)) # HWC -> CHW

    return (float_image,chw_image)

def keypoint_processor_numpy(post_inference_array: np.ndarray, 
                             scaler_height: int, 
                             scaler_width: int
                            ) -> List[Tuple[int, int]]:
    """
    Extracts keypoint coordinates from heatmaps and scales them to match the original image dimensions.

    Parameters:
    -----------
    post_inference_array : np.ndarray
        A 3D array of shape (num_keypoints, heatmap_height, heatmap_width),
        containing the model's predicted heatmaps for each keypoint.
    
    scaler_height : int
        Scaling factor for the height dimension to map from heatmap space to original image space.
    
    scaler_width : int
        Scaling factor for the width dimension to map from heatmap space to original image space.

    Returns:
    --------
    list of tuple
        A list of (y, x) coordinates (as integers) representing the scaled keypoint positions
        in the original image space.
    """
    keypoint_coordinates = []

    for keypoint in range(post_inference_array.shape[0]):
        heatmap = post_inference_array[keypoint]
        max_val_index = np.argmax(heatmap)
        img_height, img_width = np.unravel_index(max_val_index, heatmap.shape)
        coords = (int(img_height * scaler_height), int(img_width * scaler_width))
        keypoint_coordinates.append(coords)

    return keypoint_coordinates