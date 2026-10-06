import bpy
from pathlib import Path
s=bpy.context.scene
s.eevee.taa_render_samples=32
s.render.image_settings.file_format='PNG'
base=Path(bpy.path.abspath('//'))
for frame in (16,94,142,152,162,202,250,265):
    s.frame_set(frame)
    s.render.filepath=str(base/f'estado_v24_{frame:03d}.png')
    bpy.ops.render.render(write_still=True)
