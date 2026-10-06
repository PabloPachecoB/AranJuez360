import bpy
s=bpy.context.scene
shoulder=bpy.data.objects['Control brazo saludo']
values=[(73,0.0),(81,-0.65),(90,-0.65),(129,-0.65),(137,-0.65),(185,-0.65),(193,-0.65),(202,0.19),(250,0.19),(258,-0.65),(265,-0.65)]
for frame,value in values:
    s.frame_set(frame)
    rotation=shoulder.rotation_euler.copy()
    rotation.y=value
    shoulder.rotation_euler=rotation
    shoulder.keyframe_insert(data_path='rotation_euler',index=1,frame=frame,group='Reposo hablar senalar')
s.camera=bpy.data.objects['Camara tres cuartos']
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v24_animaciones.blend'))
