import bpy
s=bpy.context.scene
s.frame_set(1)
s.frame_start=1
s.frame_end=49
s.render.fps=24
s.render.resolution_x=800
s.render.resolution_y=800
s.render.resolution_percentage=100
s.eevee.taa_render_samples=64
s.render.image_settings.file_format='PNG'
s.render.filepath='//saludo_robot_'
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v22_animacion.blend'))
