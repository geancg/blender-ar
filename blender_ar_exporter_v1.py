import bpy
import os
import sys
import subprocess
import tempfile
import json
import base64
import bpy.utils.previews

# --- Addon Information ---
bl_info = {
    "name": "AR USDZ Exporter",
    "author": "Gean Guilherme Lopes",
    "version": (1, 1, 5),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > AR Exporter",
    "description": "Exports to USDZ, uploads to GitHub geancg/blender-ar, and displays QR code.",
    "category": "Import-Export",
}

# Global variables
ar_model_url = ""
preview_collections = {}

def install_pip_module(module_name):
    try:
        python_exe = sys.executable
        subprocess.check_call([python_exe, "-m", "ensurepip"])
        subprocess.check_call([python_exe, "-m", "pip", "install", module_name])
        return True
    except:
        return False

def upload_to_github(filepath, username, repo, pat):
    filename = os.path.basename(filepath).lower()
    with open(filepath, "rb") as f:
        content = base64.b64encode(f.read()).decode("utf-8")

    url = f"https://api.github.com/repos/{username}/{repo}/contents/{filename}"
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }
    
    sha = None
    try:
        import requests
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            sha = r.json().get("sha")
    except:
        pass

    data = {
        "message": f"AR Upload: {filename}",
        "content": content,
        "branch": "main"
    }
    if sha:
        data["sha"] = sha

    import requests
    r = requests.put(url, headers=headers, data=json.dumps(data), timeout=30)
    r.raise_for_status()
    return f"https://{username}.github.io/{repo}/{filename}"

# --- ADDON PREFERENCES ---
class AR_AddonPreferences(bpy.types.AddonPreferences):
    bl_idname = "blender_ar_exporter_v1"

    github_username: bpy.props.StringProperty(name="GitHub Username", default="geancg")
    repo_name: bpy.props.StringProperty(name="Repository Name", default="blender-ar")
    github_pat: bpy.props.StringProperty(name="GitHub PAT", description="Cole seu Token aqui", subtype='PASSWORD')

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "github_username")
        layout.prop(self, "repo_name")
        layout.prop(self, "github_pat")

# --- OPERATOR ---
class AR_OT_ExportAndQR(bpy.types.Operator):
    bl_idname = "ar.export_and_qr"
    bl_label = "Export & Generate QR"
    bl_description = "Exporta para USDZ e faz upload para o GitHub"

    def execute(self, context):
        global ar_model_url
        
        addon_prefs = context.preferences.addons.get("blender_ar_exporter_v1")
        if not addon_prefs:
            self.report({'ERROR'}, "Addon não encontrado nas preferências!")
            return {'CANCELLED'}
            
        prefs = addon_prefs.preferences
        if not prefs.github_pat:
            self.report({'ERROR'}, "Por favor, configure o GitHub PAT nas preferências do Addon!")
            return {'CANCELLED'}

        # 1. Dependências
        try:
            import qrcode
            import requests
        except ImportError:
            self.report({'INFO'}, "Instalando dependências... Aguarde.")
            install_pip_module("qrcode[pil]")
            install_pip_module("requests")
            import qrcode
            import requests

        # 2. Seleção
        if not context.selected_objects:
            self.report({'ERROR'}, "Selecione um objeto primeiro!")
            return {'CANCELLED'}
        
        obj = context.selected_objects[0]
        safe_name = obj.name.replace(" ", "_").lower()
        temp_path = os.path.join(tempfile.gettempdir(), f"{safe_name}.usdz")

        # 3. Exportação
        try:
            bpy.ops.wm.usd_export(filepath=temp_path)
        except Exception as e:
            self.report({'ERROR'}, f"Falha na exportação: {str(e)}")
            return {'CANCELLED'}

        # 4. Upload
        try:
            ar_model_url = upload_to_github(temp_path, prefs.github_username, prefs.repo_name, prefs.github_pat)
        except Exception as e:
            self.report({'ERROR'}, f"Falha no upload: {str(e)}")
            return {'CANCELLED'}

        # 5. QR Code
        try:
            qr = qrcode.QRCode(box_size=10, border=2)
            qr.add_data(ar_model_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            
            qr_path = os.path.join(tempfile.gettempdir(), "ar_qr_preview.png")
            img.save(qr_path)
            
            # ABORDAGEM SEGURA: Limpar e recriar a coleção de previews
            global preview_collections
            pcoll = preview_collections.get("main")
            if pcoll:
                bpy.utils.previews.remove(pcoll)
            
            pcoll = bpy.utils.previews.new()
            pcoll.load("qr_code", qr_path, 'IMAGE')
            preview_collections["main"] = pcoll
            
            self.report({'INFO'}, "Sucesso! QR Code atualizado.")
        except Exception as e:
            self.report({'ERROR'}, f"Falha no QR Code: {str(e)}")
            return {'CANCELLED'}
        
        for area in context.screen.areas:
            area.tag_redraw()
            
        return {'FINISHED'}

# --- PANEL ---
class AR_PT_Panel(bpy.types.Panel):
    bl_label = "AR Exporter"
    bl_idname = "AR_PT_main_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'AR Exporter'

    def draw(self, context):
        layout = self.layout
        layout.operator("ar.export_and_qr", icon='EXPORT')
        
        global ar_model_url
        pcoll = preview_collections.get("main")
        
        if ar_model_url and pcoll and "qr_code" in pcoll:
            box = layout.box()
            box.label(text="Escaneie para ver em AR:", icon='VIEWZOOM')
            qr_preview = pcoll["qr_code"]
            box.template_icon(icon_value=qr_preview.icon_id, scale=10.0)
            box.label(text="Aguarde 1 min para o GitHub atualizar")
            box.operator("wm.url_open", text="Abrir Link", icon='WORLD').url = ar_model_url

# --- REGISTRATION ---
classes = (AR_AddonPreferences, AR_OT_ExportAndQR, AR_PT_Panel)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    # Inicializa vazio
    preview_collections["main"] = bpy.utils.previews.new()

def unregister():
    for pcoll in preview_collections.values():
        bpy.utils.previews.remove(pcoll)
    preview_collections.clear()
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
