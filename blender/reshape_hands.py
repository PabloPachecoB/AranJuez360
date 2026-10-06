import bpy

right=bpy.data.objects['Mano animable derecha']
right_rig=bpy.data.objects['Rig mano derecha']
right.scale.x=-abs(right.scale.x)
right_rig.scale.x=-abs(right_rig.scale.x)

# Widen the modeled wrist itself where it enters the sleeve. The existing
# continuous hand surface is kept, including finger weights and rigging.
for side in ('izquierda','derecha'):
    hand=bpy.data.objects[f'Mano animable {side}']
    for vertex in hand.data.vertices:
        y=vertex.co.y
        if y <= -.18:
            vertex.co.x *= 1.10
            vertex.co.z *= 1.54
        elif y < -.12:
            t=(y+.18)/.06
            vertex.co.x *= 1.10-.05*t
            vertex.co.z *= 1.54-.20*t
        elif y < -.035:
            t=(y+.12)/.085
            vertex.co.x *= 1.05-.05*t
            vertex.co.z *= 1.34-.24*t
        elif y < .035:
            t=(y+.035)/.07
            vertex.co.z *= 1.10-.10*t
    hand.data.update()

bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v21.blend'))
