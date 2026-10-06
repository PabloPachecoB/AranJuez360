import bpy
from pathlib import Path
s=bpy.context.scene
s.eevee.taa_render_samples=32
base=Path(bpy.path.abspath('//'))
for frame in (1,13,25,49):
    s.frame_set(frame)
    s.render.filepath=str(base/f'hablar_v25_{frame:02d}.png')
    bpy.ops.render.render(write_still=True)
