"""Original CC0 game street kit. Run with Blender --background --python."""
import bpy, math, os, random
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.5,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission;return m
steel=mat('Brushed galvanized steel',(.21,.26,.29),.8,.3);black=mat('Powder coated charcoal',(.025,.035,.04),.35,.38);concrete=mat('Concrete footing',(.45,.47,.44),0,.88);silver=mat('Aluminium trim',(.6,.65,.68),.8,.24);wood=mat('Warm timber',(.29,.13,.052),0,.55)
def box(name,loc,scale,material,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Manufactured rounded edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def cylinder(name,a,b,r,material):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
def export(name):
 bpy.ops.wm.save_as_mainfile(filepath=f'{ROOT}/art/{name}.blend')
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=f'{ROOT}/public/models/street/{name}.glb',export_format='GLB',use_selection=True,export_extras=True)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
box('Cast concrete plinth',(11.8,0,.18),(.72,.72,.36),concrete)
cylinder('Main mast',(11.8,0,.2),(11.8,0,6.65),.13,steel)
cylinder('Cantilever boom',(-7.2,0,6.4),(11.8,0,6.4),.09,steel)
for x in [-5.5,4.8]:
 cylinder('Signal suspension',(x,0,6.4),(x,0,5.85),.035,steel)
 box('Traffic signal housing',(x,0,5.55),(2.25,.38,.82),black,.08)
 for offset,name,col in [(-.7,'signal_red',(1,.018,.01)),(0,'signal_amber',(1,.45,.005)),(.7,'signal_green',(.015,1,.24))]:
  m=mat(name,col,0,.24,1)
  cylinder(name,(x+offset,-.2,5.55),(x+offset,-.235,5.55),.265,m)
  box('Lens rain hood',(x+offset,-.37,5.87),(.61,.53,.055),black,.018)
  for side in [-1,1]:box('Lens hood cheek',(x+offset+side*.3,-.32,5.67),(.04,.42,.35),black,.01)
for dx in [-.23,.23]:
 for dy in [-.23,.23]:cylinder('Anchor bolt',(11.8+dx,dy,.34),(11.8+dx,dy,.42),.035,silver)
cylinder('Pedestrian mast',(12.6,-3,0),(12.6,-3,3.3),.07,steel)
box('Pedestrian signal case',(12.6,-3,2.75),(.48,.28,1.05),black,.06)
for z,name,col in [(3,'walk_red',(1,.025,.008)),(2.52,'walk_green',(.02,1,.22))]:
 m=mat(name,col,0,.4,1);cylinder(name+'_head',(12.6,-3.16,z+.1),(12.6,-3.18,z+.1),.05,m)
 box(name+'_body',(12.6,-3.18,z-.01),(.07,.025,.13),m,.01)
 for sign in [-1,1]:
  limb=box(name+'_leg',(12.6+sign*.045,-3.18,z-.115),(.035,.025,.13),m,.008);limb.rotation_euler.y=sign*.3
export('signal')
# Glass and metal shelter with separated roof ribs, bench slats and route board.
glass=mat('Tinted shelter glass',(.22,.42,.45),.12,.15);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.38;glass.surface_render_method='DITHERED'
for x in [-2.5,2.5]:
 for y in [0,1.6]:box('Shelter column',(x,y,1.45),(.1,.1,2.9),steel)
box('Shelter roof',(0,.8,2.95),(5.4,2.15,.14),black,.05)
for x in [-2.5,-1.25,0,1.25,2.5]:box('Roof rib',(x,.8,3.05),(.04,2.1,.035),silver,.005)
for x in [-1.75,0,1.75]:box('Rear glass',(x,1.57,1.55),(1.65,.035,2.35),glass,.008)
box('Side glass',(-2.47,.8,1.55),(.035,1.45,2.35),glass,.008)
for x in [-1.7,1.7]:box('Bench legs',(x,.85,.3),(.08,.6,.6),steel)
for y in [.55,.73,.91,1.09]:box('Bench timber slat',(0,y,.64),(4,.14,.08),wood,.025)
box('Bench back',(0,1.17,.95),(4,.08,.35),wood,.025)
box('Information panel',(2,1.5,1.7),(.65,.1,1.3),black)
box('Route sheet',(2,1.435,1.7),(.55,.012,1.15),mat('Route paper',(.85,.91,.86)),.005)
export('shelter')
# Branching tree with individually oriented leaf clusters, optimized into four materials.
r=random.Random(25);bark=mat('Tree bark',(.12,.07,.033),0,.94)
leaves=[mat('Foliage '+str(i),col,0,.93) for i,col in enumerate([(.055,.16,.034),(.1,.24,.055),(.18,.32,.068)])]
cylinder('Trunk',(0,0,0),(.12,0,5.5),.17,bark)
for k in range(11):
 angle=k*2.4;h=3+k*.24;end=Vector((math.cos(angle)*(1.5+r.random()),math.sin(angle)*(1.5+r.random()),h+1.2));cylinder('Branch',(.08,0,h),end,.045,bark)
 for j in range(20):
  p=end+Vector((r.uniform(-1,1),r.uniform(-1,1),r.uniform(-.55,.7)))
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r.uniform(.28,.62),location=p);o=bpy.context.object;o.name='Leaf spray';o.scale=(1,.6,.45);o.rotation_euler=(r.random()*3,r.random()*3,r.random()*6);o.data.materials.append(leaves[(j+k)%3])
  for poly in o.data.polygons:poly.use_smooth=True
for material in [bark]+leaves:
 bpy.ops.object.select_all(action='DESELECT');objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==material]
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
export('tree')
# Seamless, deterministic asphalt aggregate, authored in Blender.
r=random.Random(911);n=512;image=bpy.data.images.new('Asphalt aggregate',width=n,height=n);pixels=[]
for y in range(n):
 for x in range(n):
  grain=r.random();v=.34+(grain-.5)*.19
  if grain>.974:v+=.18
  if grain<.024:v-=.1
  pixels.extend((v,v,v,1))
image.pixels.foreach_set(pixels);image.filepath_raw=f'{ROOT}/public/textures/asphalt.png';image.file_format='PNG';image.save()
print('STREET_KIT_EXPORTED')
