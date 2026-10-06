import bpy
from mathutils import Matrix, Vector

scene=bpy.context.scene
root=bpy.data.objects['Control global mascota']
shoulder=bpy.data.objects['Control brazo saludo']
wrist=bpy.data.objects['Control muñeca saludo']
head_parts=[
    'Ala sombrero con volumen','Banda amarilla','Base cerrada sombrero',
    'Boca sonrisa integrada','Cabeza azul','Ceja derecho','Ceja izquierdo',
    'Centro oreja derecho','Centro oreja izquierdo','Copa sombrero',
    'Interior amarillo boca','Brillo grande ojo derecho','Brillo grande ojo izquierdo',
    'Brillo pequeno ojo derecho','Brillo pequeno ojo izquierdo','Ojo derecho','Ojo izquierdo',
    'Oreja derecho','Oreja izquierdo','Rostro blanco integrado',
]

def parent_keep_world(obj,parent):
    world=obj.matrix_world.copy()
    obj.parent=parent
    obj.matrix_world=world

head=bpy.data.objects.get('Control cabeza')
if not head:
    head=bpy.data.objects.new('Control cabeza',None)
    bpy.context.collection.objects.link(head)
    head.empty_display_type='SPHERE'
    head.empty_display_size=0.14
    head.show_in_front=True
    head.parent=root
    head.matrix_world=Matrix.Translation(Vector((0,0,2.55)))
    for name in head_parts:
        parent_keep_world(bpy.data.objects[name],head)

def key_value(obj,prop,axis,frame,value):
    scene.frame_set(frame)
    vector=getattr(obj,prop).copy()
    vector[axis]=value
    setattr(obj,prop,vector)
    obj.keyframe_insert(data_path=prop,index=axis,frame=frame,group=obj.name)

# New ranges follow the first greeting clip on the same timeline.
scene.frame_end=265

# Idle: slow, subtle floating motion with a small head sway.
for frame,value in [(73,0.0),(81,0.0),(90,0.012),(99,0.0),(108,0.012),(117,0.0),(126,0.012),(129,0.0),(137,0.0)]:
    key_value(root,'location',2,frame,value)
for frame,value in [(73,0.0),(81,0.0),(94,0.025),(107,-0.025),(120,0.02),(129,0.0),(137,0.0)]:
    key_value(head,'rotation_euler',2,frame,value)

# Talking: open the existing smile slightly and reveal more of the yellow mouth interior.
mouth=bpy.data.objects['Boca sonrisa integrada']
if not mouth.data.shape_keys:
    basis=mouth.shape_key_add(name='Neutral')
    open_key=mouth.shape_key_add(name='Boca abierta')
    min_z=min(v.co.z for v in basis.data)
    max_z=max(v.co.z for v in basis.data)
    center=(min_z+max_z)/2.0
    for i,base_v in enumerate(basis.data):
        open_key.data[i].co.z=center+(base_v.co.z-center)*1.65
mouth.data.shape_keys.name='Formas boca mascota'
open_key=mouth.data.shape_keys.key_blocks['Boca abierta']
interior=bpy.data.objects['Interior amarillo boca']
default_interior_z=interior.scale.z
talk_values=[(137,0.0),(142,0.75),(147,0.18),(152,1.0),(157,0.12),(162,0.70),(167,0.0),(173,0.80),(179,0.14),(185,0.0),(193,0.0)]
for frame,value in talk_values:
    scene.frame_set(frame)
    open_key.value=value
    open_key.keyframe_insert(data_path='value',frame=frame,group='Hablar boca')
    interior.scale.z=default_interior_z*(1.0+0.9*value)
    interior.keyframe_insert(data_path='scale',index=2,frame=frame,group='Hablar boca')
for frame,value in [(137,0.0),(148,0.01),(158,0.0),(169,0.01),(185,0.0),(193,0.0)]:
    key_value(root,'location',2,frame,value)
for frame,value in [(137,0.0),(151,-0.025),(163,0.02),(175,-0.02),(185,0.0),(193,0.0)]:
    key_value(head,'rotation_euler',2,frame,value)

# Point: raise the arm, keep the index extended and curl the other fingers.
for frame,value in [(185,0.0),(193,0.0),(202,0.19),(250,0.19),(258,0.0),(265,0.0)]:
    key_value(shoulder,'rotation_euler',1,frame,value)
for frame,value in [(185,0.0),(193,0.0),(202,0.20),(250,0.20),(258,0.0),(265,0.0)]:
    key_value(wrist,'rotation_euler',1,frame,value)

rig=bpy.data.objects['Rig mano izquierda']
for bone_name in ('medio_1','medio_2','anular_1','anular_2','pulgar_1','pulgar_2','indice_1','indice_2'):
    rig.pose.bones[bone_name].rotation_mode='XYZ'
for frame in (185,193,202,250,258,265):
    scene.frame_set(frame)
    for bone_name in ('medio_1','medio_2','anular_1','anular_2','pulgar_1','pulgar_2','indice_1','indice_2'):
        rig.pose.bones[bone_name].rotation_euler=(0.0,0.0,0.0)
        rig.pose.bones[bone_name].keyframe_insert(data_path='rotation_euler',frame=frame,group='Senalar dedos')
    if frame in (202,250):
        for bone_name in ('medio_1','medio_2','anular_1','anular_2'):
            rig.pose.bones[bone_name].rotation_euler.x=1.25
        for bone_name in ('pulgar_1','pulgar_2'):
            rig.pose.bones[bone_name].rotation_euler.x=0.65
        for bone_name in ('medio_1','medio_2','anular_1','anular_2','pulgar_1','pulgar_2'):
            rig.pose.bones[bone_name].keyframe_insert(data_path='rotation_euler',frame=frame,group='Senalar dedos')

for marker in list(scene.timeline_markers):
    scene.timeline_markers.remove(marker)
for label,frame in [
    ('Saludo',1),('Reposo',81),('Hablar',137),('Senalar',193),('Fin',265)
]:
    scene.timeline_markers.new(label,frame=frame)

scene.camera=bpy.data.objects['Camara tres cuartos']
scene.frame_start=1
scene.frame_end=265
scene.frame_set(1)
scene.render.fps=24
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.eevee.taa_render_samples=64
scene.render.image_settings.file_format='PNG'
scene.render.filepath='//mascota_animaciones_'
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v24_animaciones.blend'))
