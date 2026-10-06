import bpy
src=r'C:\Formatear\Projects\AranJuez360\blender\mascota_paseo_aranjuez_3d_boceto_v25_hablar.blend'
out=r'C:\Formatear\Projects\AranJuez360\blender\mascota_paseo_aranjuez_3d_boceto_v26_hablar_senalando.blend'
bpy.ops.wm.open_mainfile(filepath=src)
scene=bpy.context.scene
scene.frame_start=1; scene.frame_end=49; scene.render.fps=24
rig=bpy.data.objects['Rig GLB izquierda']
# Flexionar dedos alrededor del eje visible desde cámara; el índice queda levantado para señalar.
point_pose={'indice_1':-0.85,'indice_2':-1.0,'medio_1':-0.3,'medio_2':-0.5,'anular_1':0.65,'anular_2':0.8,'menique_1':1.0,'menique_2':1.15,'pulgar_1':-0.2,'pulgar_2':-0.2}
for bone in rig.pose.bones:
 bone.rotation_mode='XYZ'
 for frame in [1,13,25,37,49]:
  amount=0.92 if frame==37 else 1.0
  bone.rotation_euler=(0,0,point_pose.get(bone.name,0)*amount)
  bone.keyframe_insert(data_path='rotation_euler',frame=frame,group='Hablar y señalar - Dedos')
if rig.animation_data and rig.animation_data.action:
 rig.animation_data.action.name='Hablar y señalar - Mano GLB izquierda'
scene.timeline_markers.clear(); scene.timeline_markers.new('Hablar y señalar',frame=1); scene.timeline_markers.new('Énfasis',frame=37); scene.timeline_markers.new('Cierre',frame=49)
scene.frame_set(13)
scene.camera=bpy.data.objects.get('Camara frontal') or scene.camera
scene.render.resolution_x=800; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=r'C:\Formatear\Projects\AranJuez360\blender\hablar_senalando_v26_preview.png'
bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=out)
