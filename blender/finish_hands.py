import bpy
from math import cos, sin, tau
from mathutils import Matrix

left = bpy.data.objects['Mano animable izquierda']
right = bpy.data.objects['Mano animable derecha']
right_rig = bpy.data.objects['Rig mano derecha']

# The original hands share one mesh. Reverse the right local X axis on both
# the glove and its matching rig so the thumb and finger fan are handed.
right.scale.x = -abs(right.scale.x)
right_rig.scale.x = -abs(right_rig.scale.x)

material = bpy.data.materials['Blanco hueso guantes robot']
segments = 32
# A soft rolled glove opening fills the narrow wrist and tucks under the sleeve.
# Coordinates follow the rigged hand: +Y runs from wrist towards fingertips.
profile = [
    (-0.225, 0.108, 0.085),
    (-0.205, 0.131, 0.112),
    (-0.170, 0.146, 0.129),
    (-0.130, 0.157, 0.132),
    (-0.095, 0.156, 0.121),
    (-0.060, 0.148, 0.101),
    (-0.035, 0.137, 0.083),
]

for side in ('izquierda', 'derecha'):
    hand = bpy.data.objects[f'Mano animable {side}']
    rig = bpy.data.objects[f'Rig mano {side}']
    verts = []
    faces = []
    for y, rx, rz in profile:
        for i in range(segments):
            a = tau*i/segments
            verts.append((rx*cos(a), y, rz*sin(a)))
    for j in range(len(profile)-1):
        for i in range(segments):
            ni=(i+1)%segments
            faces.append((j*segments+i,j*segments+ni,(j+1)*segments+ni,(j+1)*segments+i))
    faces.append(tuple(reversed(tuple(range(segments)))))
    faces.append(tuple((len(profile)-1)*segments+i for i in range(segments)))
    mesh=bpy.data.meshes.new(f'Puño guante {side} malla')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(material)
    cuff=bpy.data.objects.new(f'Puño guante {side}', mesh)
    bpy.context.collection.objects.link(cuff)
    cuff.parent=hand
    cuff.matrix_parent_inverse=Matrix.Identity(4)
    cuff.matrix_basis=Matrix.Identity(4)
    group=cuff.vertex_groups.new(name='mano')
    group.add(list(range(len(verts))), 1.0, 'REPLACE')
    armature=cuff.modifiers.new('Rig de muñeca', 'ARMATURE')
    armature.object=rig
    smooth=cuff.modifiers.new('Suavizado del puño', 'SUBSURF')
    smooth.levels=2
    smooth.render_levels=2
    for poly in mesh.polygons:
        poly.use_smooth=True

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v19.blend'))
