import bpy

scene=bpy.context.scene
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.eevee.taa_render_samples=64
scene.render.fps=24
scene.frame_start=1
scene.frame_end=49
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.render.filepath=bpy.path.abspath('//saludo_robot.mp4')
scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4'
scene.render.ffmpeg.codec='H264'
scene.render.ffmpeg.constant_rate_factor='MEDIUM'
scene.render.ffmpeg.ffmpeg_preset='GOOD'
scene.render.ffmpeg.gopsize=12
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v22_animacion.blend'))
bpy.ops.render.render(animation=True)
