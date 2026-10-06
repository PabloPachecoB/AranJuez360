import bpy
from pathlib import Path
s=bpy.context.scene
s.eevee.taa_render_samples=32
s.render.image_settings.file_format='PNG'
base=Path(bpy.path.abspath('//'))
for frame in (1,10,16,24,32,40,48,56,63,73):
    s.frame_set(frame)
    s.render.filepath=str(base/f'saludo_v23_{frame:02d}.png')
    bpy.ops.render.render(write_still=True)
