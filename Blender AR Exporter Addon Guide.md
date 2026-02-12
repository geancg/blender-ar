# Blender AR Exporter Addon Guide

This guide provides instructions on how to use the Blender addon to export selected objects to USDZ format, upload them to GitHub Pages, and generate a QR code for Augmented Reality (AR) viewing.

---

## 1. Addon Overview

The "AR USDZ Exporter with QR Code" addon simplifies the process of preparing 3D models from Blender for WebAR experiences. It automates the following steps:

1.  **USDZ Export**: Exports the currently selected 3D object in Blender to the `.usdz` format, which is widely supported for AR viewing on iOS (AR Quick Look) and Android (Scene Viewer).
2.  **GitHub Pages Upload**: Uploads the generated `.usdz` file to your specified GitHub repository, which is then served via GitHub Pages, making it accessible via a unique, direct URL.
3.  **QR Code Generation**: Creates a QR code image that, when scanned with a smartphone camera, will open the uploaded `.usdz` model directly in an AR viewer.
4.  **Automatic Dependency Installation**: The addon will attempt to install the necessary `qrcode` and `requests` Python libraries automatically upon activation if they are not found.

---

## 2. Prerequisites

Before installing and using the addon, ensure you have the following:

-   **Blender**: Version 3.0 or newer installed.
-   **Internet Connection**: Required for the addon to automatically install libraries and for uploading the USDZ model to GitHub.
-   **USD Export Addon**: Ensure Blender's built-in `USD` addon (usually found under `Edit > Preferences > Add-ons > Import-Export: Universal Scene Description (USD)`) is enabled. This is typically enabled by default.
-   **GitHub Account and Repository**: You need a GitHub account and a **public repository** with **GitHub Pages enabled**. Refer to the "GitHub Setup Guide" for detailed instructions on how to set this up and generate a Personal Access Token (PAT).

---

## 3. Addon Installation

1.  **Save the Addon File**: Save the provided Python code (e.g., `blender_ar_exporter_addon.py`) to an easily accessible location on your computer.
2.  **Open Blender**: Launch Blender.
3.  **Access Preferences**: Go to `Edit > Preferences...`.
4.  **Install the Addon**: 
    -   In the Blender Preferences window, click on the `Add-ons` tab on the left side.
    -   Click the `Install...` button in the top right corner.
    -   Navigate to where you saved the `blender_ar_exporter_addon.py` file, select it, and click `Install Add-on`.
5.  **Enable the Addon**: 
    -   After installation, Blender will list your addon. You can use the search bar to find it quickly (type "AR USDZ Exporter").
    -   Check the box next to the addon's name (`AR USDZ Exporter with QR Code`) to enable it.
    -   **Important**: The first time you enable the addon, it will attempt to install the `qrcode` and `requests` Python libraries. This might take a moment, and you may see messages in Blender's system console (`Window > Toggle System Console`) indicating the installation progress. Blender might appear unresponsive during this process. Restarting Blender after the first activation (and successful installation) is recommended.

---

## 4. Configure GitHub Credentials in Addon Preferences

After enabling the addon, you need to provide your GitHub details:

1.  **Open Addon Preferences**: In Blender's `Edit > Preferences...` window, go to the `Add-ons` tab. Find "AR USDZ Exporter with QR Code" and expand its details by clicking the arrow next to its name.
2.  **Enter GitHub Details**: Fill in the following fields:
    *   **GitHub Username**: Your GitHub username (e.g., `your-username`).
    *   **Repository Name**: The name of your public GitHub repository where you enabled GitHub Pages (e.g., `blender-ar-models`).
    *   **GitHub Personal Access Token (PAT)**: The PAT you generated with `repo` scope. **Keep this token secure!**
3.  **Save Preferences**: Click `Save Preferences` at the bottom left of the Preferences window.

---

## 5. How to Use the Addon

1.  **Prepare Your 3D Model**: 
    -   In Blender, create or open a scene with the 3D object you wish to export for AR.
    -   **Select the object** in the 3D Viewport that you want to export. Only the selected object will be exported.

2.  **Access the Addon Panel**: 
    -   In the 3D Viewport, press the `N` key to open the sidebar (N-panel).
    -   Look for a new tab named `AR Exporter`.

3.  **Export and Generate QR Code**: 
    -   Within the `AR Exporter` panel, you will see a button labeled `Export USDZ & Generate QR`.
    -   Click this button.

4.  **View Results**: 
    -   The addon will perform the export, upload to GitHub Pages, and QR code generation.
    -   Upon successful completion, the panel will update to display:
        -   The file path where the QR code image is saved locally.
        -   The public URL of your uploaded USDZ model on GitHub Pages.
        -   A button to `Open QR Code Image` (for quick viewing of the generated QR code).
        -   A button to `Open AR Model URL` (to directly open the AR model in your browser, which should trigger the AR viewer on compatible devices).

5.  **Scan the QR Code**: 
    -   Use your smartphone's camera to scan the displayed QR code (either from the opened image or directly from your screen).
    -   This will open the USDZ model in your device's native AR viewer (e.g., AR Quick Look on iOS, Scene Viewer on Android), allowing you to place and interact with your 3D model in the real world.

---

## 6. Troubleshooting

-   **"No object selected" error**: Ensure you have a 3D object selected in the 3D Viewport before clicking the export button.
-   **`qrcode` or `requests` library not found (after initial activation)**: If the automatic installation failed, check Blender's system console for errors. You might need to manually install it into Blender's Python environment. Restart Blender after installation.
-   **Failed to export USDZ**: Ensure Blender's built-in `USD` addon is enabled in preferences.
-   **GitHub API errors (e.g., 401 Unauthorized, 404 Not Found)**: 
    *   Double-check your GitHub Username, Repository Name, and Personal Access Token (PAT) in the addon preferences.
    *   Ensure your PAT has the `repo` scope enabled.
    *   Verify that the repository name is correct and that GitHub Pages is enabled for it.
    *   Confirm your repository is **public**.
-   **AR model not loading**: Verify that the generated URL on GitHub Pages is correct and publicly accessible. Check your internet connection. Some older devices or browsers might not fully support WebAR or AR Quick Look.
-   **Addon not appearing in the list/errors upon activation**: Refer to the basic addon troubleshooting steps (check `bl_info`, Blender system console for errors).

This addon provides a powerful workflow to quickly turn your Blender creations into interactive AR experiences. Enjoy!
