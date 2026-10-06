import bpy
from mathutils import Matrix, Vector

scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=1
scene.frame_end=73
scene.frame_set(1)

def parent_keep_world(obj,parent):
    world=obj.matrix_world.copy()
    obj.parent=parent
    obj.matrix_world=world

def make_control(name,parent,position,size):
    control=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(control)
    control.empty_display_type='SPHERE'
    control.empty_display_size=size
    control.show_in_front=True
    if parent:
        control.parent=parent
    control.matrix_world=Matrix.Translation(Vector(position))
    return control

root=make_control('Control global mascota',None,(0,0,0),0.22)
for obj in list(bpy.data.objects):
    if obj is root or obj.type in {'CAMERA','LIGHT'} or obj.name=='Suelo revision':
        continue
    if obj.parent is None:
        parent_keep_world(obj,root)

shoulder=make_control('Control brazo saludo',root,(-0.61,0,2.30),0.15)
parent_keep_world(bpy.data.objects['Brazo izquierdo continuo'],shoulder)
wrist=make_control('Control muñeca saludo',shoulder,(-1.11,-0.05,1.98),0.10)
for name in ('Mano animable izquierda','Rig mano izquierda'):
    parent_keep_world(bpy.data.objects[name],wrist)

def key_value(obj,prop,axis,rows):
    for frame,value in rows:
        vector=getattr(obj,prop).copy()
        vector[axis]=value
        setattr(obj,prop,vector)
        obj.keyframe_insert(data_path=prop,index=axis,frame=frame,group=obj.name)

# Slight anticipation and body bounce while the arm rises and settles.
key_value(root,'location',2,[(1,0.0),(8,0.02),(15,0.04),(25,0.025),(38,0.025),(50,0.04),(61,0.02),(68,0.015),(73,0.0)])
# Hold the arm up throughout the wave, then lower it back into its starting pose.
key_value(shoulder,'rotation_euler',1,[(1,0.0),(10,0.25),(63,0.25),(73,0.0)])
# Three clear side-to-side hand waves, with a short hold before lowering.
key_value(wrist,'rotation_euler',1,[(1,0.0),(10,0.0),(16,0.48),(24,-0.48),(32,0.48),(40,-0.48),(48,0.48),(56,-0.48),(63,0.0),(73,0.0)])

for obj,label in ((root,'Saludo cuerpo'),(shoulder,'Saludo brazo'),(wrist,'Saludo muñeca')):
    if obj.animation_data and obj.animation_data.action:
        obj.animation_data.action.name=label

scene.timeline_markers.clear()
for label,frame in [('Inicio',1),('Eleva brazo',10),('Saluda',16),('Cambio de lado',24),('Cierra saludo',63),('Pose inicial',73)]:
    scene.timeline_markers.new(label,frame=frame)
scene.camera=bpy.data.objects['Camara tres cuartos']
scene.eevee.taa_render_samples=64
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath='//saludo_v23_'
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v23_saludo.blend'))
