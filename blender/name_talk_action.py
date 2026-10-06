import bpy
mouth=bpy.data.objects['Boca sonrisa integrada']
interior=bpy.data.objects['Interior amarillo boca']
if mouth.data.shape_keys and mouth.data.shape_keys.animation_data and mouth.data.shape_keys.animation_data.action:
    mouth.data.shape_keys.animation_data.action.name='Hablar - Forma de boca'
if interior.animation_data and interior.animation_data.action:
    interior.animation_data.action.name='Hablar - Interior'
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v25_hablar.blend'))
