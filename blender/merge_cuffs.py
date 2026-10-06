import bpy

for side in ('izquierda','derecha'):
    hand=bpy.data.objects[f'Mano animable {side}']
    cuff=bpy.data.objects[f'Puño guante {side}']
    before=(len(hand.data.vertices),len(hand.data.polygons))
    modifier=hand.modifiers.new('Unión continua palma y puño','BOOLEAN')
    modifier.operation='UNION'
    modifier.solver='EXACT'
    modifier.object=cuff
    hand.modifiers.move(len(hand.modifiers)-1,0)
    bpy.context.view_layer.objects.active=hand
    hand.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    hand.select_set(False)
    print(side, before, '->', (len(hand.data.vertices),len(hand.data.polygons)))
    for polygon in hand.data.polygons:
        polygon.use_smooth=True
    bpy.data.objects.remove(cuff, do_unlink=True)
    # The added wrist vertices follow the palm bone. Finger weights stay intact.
    palm_group=hand.vertex_groups['mano']
    new_vertices=list(range(before[0],len(hand.data.vertices)))
    if new_vertices:
        palm_group.add(new_vertices,1.0,'REPLACE')

bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//mascota_paseo_aranjuez_3d_boceto_v20.blend'))
