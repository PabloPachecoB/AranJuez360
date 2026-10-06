import bpy

scene=bpy.context.scene
scene.frame_start=1
scene.frame_end=49
scene.render.fps=24
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.eevee.taa_render_samples=64
scene.camera=bpy.data.objects.get('Camara frontal') or scene.camera

mouth=bpy.data.objects['Boca sonrisa integrada']
interior=bpy.data.objects['Interior amarillo boca']

# Keep the current smile as the neutral shape and add a wider opening target.
if not mouth.data.shape_keys:
    basis=mouth.shape_key_add(name='Neutral')
else:
    basis=mouth.data.shape_keys.key_blocks[0]
open_key=mouth.shape_key_add(name='Hablar abierta')
low=min(v.co.z for v in basis.data)
high=max(v.co.z for v in basis.data)
center=(low+high)*0.5
for i,vertex in enumerate(basis.data):
    open_key.data[i].co.z=center+(vertex.co.z-center)*1.65
mouth.data.shape_keys.name='Boca robot - visemas'

default_scale_z=interior.scale.z
talk_keys=[
    (1,0.0),(5,0.80),(9,0.18),(13,1.0),(17,0.12),(21,0.72),
    (25,0.0),(29,0.88),(33,0.20),(37,1.0),(41,0.12),(45,0.78),(49,0.0),
]
for frame,value in talk_keys:
    scene.frame_set(frame)
    open_key.value=value
    open_key.keyframe_insert(data_path='value',frame=frame,group='Hablar - Boca')
    interior.scale.z=default_scale_z*(1.0+0.9*value)
    interior.keyframe_insert(data_path='scale',index=2,frame=frame,group='Hablar - Interior')

scene.timeline_markers.clear()
scene.timeline_markers.new('Hablar',frame=1)
scene.timeline_markers.new('Cierre',frame=49)
scene.frame_set(1)
scene.render.image_settings.file_format='PNG'
scene.render.filepath='//mascota_hablando_'
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v25_hablar.blend'))
