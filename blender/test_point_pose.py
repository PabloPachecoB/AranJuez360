import bpy
s=bpy.context.scene
s.frame_set(73)
rig=bpy.data.objects['Rig mano izquierda']
for name in ('medio_1','medio_2','anular_1','anular_2'):
    bone=rig.pose.bones[name]
    bone.rotation_mode='XYZ'
    bone.rotation_euler[0]=0.9
for name in ('pulgar_1','pulgar_2'):
    bone=rig.pose.bones[name]
    bone.rotation_mode='XYZ'
    bone.rotation_euler[0]=0.5
bpy.data.objects['Control brazo saludo'].rotation_euler.y=0.25
bpy.context.view_layer.update()
s.eevee.taa_render_samples=32
s.render.resolution_x=800
s.render.resolution_y=800
s.render.filepath=bpy.path.abspath('//point_test.png')
bpy.ops.render.render(write_still=True)
