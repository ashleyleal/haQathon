param (
    [string]$extra_reqs_file = ""
)

python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org "qai_hub_models[stable-diffusion-v2-1-quantized]==0.29"
# Onnxruntime and onnxruntime-qnn conflict because they install the same binaries.
# Uninstall both to avoid conflicts. Then reinstall qnn to make sure we have the right binaries.
python -m pip uninstall --yes onnxruntime onnxruntime-qnn
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org onnxruntime-qnn==1.22

if ($extra_reqs_file -ne "") {
    python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org $extra_reqs_file
}
