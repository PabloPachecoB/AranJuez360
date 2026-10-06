import bpy
from mathutils import Matrix, Vector

scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=1
scene.frame_end=49
scene.frame_set(1)

def parent_keep_world(obj, parent):
    world=obj.matrix_world.copy()
    obj.parent=parent
    obj.matrix_world=world

def make_control(name, parent, position, display_size):
    empty=bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.empty_display_type='SPHERE'
    empty.empty_display_size=display_size
    empty.show_in_front=True
    if parent:
        empty.parent=parent
    empty.matrix_world=Matrix.Translation(Vector(position))
    return empty

root=make_control('Control global mascota',None,(0,0,0),0.22)
# Keep all of the character pieces together while leaving cameras, lights and ground fixed.
for obj in list(bpy.data.objects):
    if obj is root or obj.type in {'CAMERA','LIGHT'} or obj.name=='Suelo revision':
        continue
    if obj.parent is None:
        parent_keep_world(obj,root)

shoulder=make_control('Control brazo saludo',root,(-0.61,0,2.30),0.15)
arm=bpy.data.objects['Brazo izquierdo continuo']
parent_keep_world(arm,shoulder)

wrist=make_control('Control muñeca saludo',shoulder,(-1.11,-0.05,1.98),0.10)
for name in ('Mano animable izquierda','Rig mano izquierda'):
    parent_keep_world(bpy.data.objects[name],wrist)

def key_scalar(obj, data_path, index, rows):
    for frame,value in rows:
        if data_path=='location':
            vec=obj.location.copy()
            vec[index]=value
            obj.location=vec
        else:
            vec=obj.rotation_euler.copy()
            vec[index]=value
            obj.rotation_euler=vec
        obj.keyframe_insert(data_path=data_path,index=index,frame=frame,group=obj.name)

# A two-cycle friendly wave with a small, soft body bounce.
key_scalar(root,'location',2,[(1,0.0),(7,0.025),(13,0.04),(19,0.025),(25,0.0),(31,0.025),(37,0.04),(43,0.025),(49,0.0)])
key_scalar(shoulder,'rotation_euler',1,[(1,0.0),(7,0.12),(13,0.08),(19,0.14),(25,0.0),(31,0.12),(37,0.08),(43,0.14),(49,0.0)])
key_scalar(wrist,'rotation_euler',1,[(1,0.0),(7,-0.28),(13,0.30),(19,-0.28),(25,0.0),(31,-0.28),(37,0.30),(43,-0.28),(49,0.0)])

scene.timeline_markers.clear()
scene.timeline_markers.new('Inicio del saludo',frame=1)
scene.timeline_markers.new('Cambio de mano',frame=13)
scene.timeline_markers.new('Pausa breve',frame=25)
scene.timeline_markers.new('Segundo saludo',frame=37)
scene.timeline_markers.new('Vuelve a inicio',frame=49)
scene.frame_set(1)
scene.render.filepath='//mascota_saludo_'
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v22_animacion.blend'))
