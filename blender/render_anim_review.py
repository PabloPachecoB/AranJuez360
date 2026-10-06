import bpy
from pathlib import Path
s=bpy.context.scene
s.render.resolution_x=800
s.render.resolution_y=800
s.render.resolution_percentage=100
s.eevee.taa_render_samples=32
s.render.image_settings.file_format='PNG'
base=Path(bpy.path.abspath('//'))
for frame in (1,7,13,19,25,37,43,49):
    s.frame_set(frame)
    s.render.filepath=str(base/f'anim_review_{frame:02d}.png')
    bpy.ops.render.render(write_still=True)
