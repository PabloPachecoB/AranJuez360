import bpy
from pathlib import Path

scene = bpy.context.scene
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
for camera_name, filename in [
    ('Camara frontal', 'review_front.png'),
    ('Camara tres cuartos', 'review_three_quarter.png'),
]:
    scene.camera = bpy.data.objects[camera_name]
    scene.render.filepath = str(Path(bpy.path.abspath('//')) / filename)
    bpy.ops.render.render(write_still=True)
