import bpy
from pathlib import Path
s=bpy.context.scene
s.eevee.taa_render_samples=32
s.render.resolution_x=800
s.render.resolution_y=800
s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'
base=Path(bpy.path.abspath('//'))
for name in ('Camara frontal','Camara tres cuartos'):
    s.camera=bpy.data.objects[name]
    s.render.filepath=str(base/f'actual_v18_{name.replace(" ","_")}.png')
    bpy.ops.render.render(write_still=True)
