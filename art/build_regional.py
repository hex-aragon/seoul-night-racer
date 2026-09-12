"""Original CC0 Korean roadside architecture. Non-destructive Blender scene."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
old=bpy.context.window.scene
scene=bpy.data.scenes.new('Seoul Drive regional assets');bpy.context.window.scene=scene
os.makedirs(ROOT+'/public/models/regions',exist_ok=True)
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.65;return m
wood=mat('Warm cedar',(.32,.15,.065));roof=mat('Charcoal roof tiles',(.12,.17,.19));wall=mat('Warm plaster',(.85,.79,.65));glass=mat('Blue window glazing',(.19,.43,.49));red=mat('Lighthouse red',(.65,.14,.09));white=mat('White painted steel',(.88,.87,.8));green=mat('Sage cladding',(.32,.44,.32))
def box(n,p,s,m,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cylinder(n,p,r,d,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d,location=p);o=bpy.context.object;o.name=n;o.data.materials.append(m);return o
def tiled_roof(w,d,z):
 # Curving eaves, ridge caps and separate tile courses.
 for side in [-1,1]:
  for j in range(12):
   x=side*(j+.5)*w/24;t=abs(x)/(w/2);h=z+1.55*(1-t)+.4*t*t*t
   o=box('Curved tile course',(x,0,h),(w/23,d,.13),roof,.035);o.rotation_euler.y=side*.23
   for y in range(int(-d/2),int(d/2)+1):
    o=box('Tile rib',(x,y,h+.07),(w/23,.055,.055),roof,.012);o.rotation_euler.y=side*.23
 box('Roof ridge',(0,0,z+1.68),(.22,d+.3,.25),roof,.08)
def export(n):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=f'{ROOT}/public/models/regions/{n}.glb',export_format='GLB',use_selection=True,export_extras=True)
 # Only our scene's asset library is saved; user's scene is untouched.
 bpy.data.libraries.write(f'{ROOT}/art/{n}.blend',{scene},fake_user=True)
 for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
# Korean tiled-roof courtyard house.
box('Stone foundation',(0,0,.3),(12,7,.6),wall)
box('Plastered walls',(0,0,2),(10,5,3.4),wall)
for x in [-5,-2.5,0,2.5,5]:
 for y in [-2.6,2.6]:box('Timber posts',(x,y,2),(.22,.22,3.7),wood)
for x in [-3.7,-1.2,1.2,3.7]:
 box('Wood framed window',(x,-2.55,2),(1.8,.12,2.3),wood);box('Paper window',(x,-2.63,2),(1.55,.06,2.05),wall)
 for k in [-.5,0,.5]:box('Window lattice',(x+k,-2.68,2),(.04,.04,2.05),wood,.005)
tiled_roof(13,7.7,3.4);export('hanok')
# Open lakeside pavilion.
box('Pavilion stone plinth',(0,0,.25),(7,7,.5),wall)
for x in [-2.5,2.5]:
 for y in [-2.5,2.5]:box('Pavilion column',(x,y,2),(.25,.25,3.5),wood)
for x in [-2.5,2.5]:box('Bench',(x,0,.9),(.65,5,.14),wood)
tiled_roof(7.5,7.2,3.6);export('pavilion')
# Roadside cafe with timber terrace and parasols.
box('Cafe walls',(0,0,2),(10,7,4),wall);box('Cafe flat roof',(0,0,4.2),(10.5,7.5,.35),green)
for x in [-3.3,0,3.3]:box('Cafe glazing',(x,-3.52,2),(2.9,.08,3),glass)
for y in range(12):box('Terrace boards',(0,-4-y*.28,.2),(13,.25,.2),wood,.015)
for x in [-4,4]:
 cylinder('Table',(x,-5.5,1),.7,.12,wood);cylinder('Table leg',(x,-5.5,.55),.09,1,white);cylinder('Parasol mast',(x,-5.5,1.65),.035,3.2,white)
 bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=1.8,radius2=.15,depth=.7,location=(x,-5.5,3.1));bpy.context.object.data.materials.append(wall)
export('cafe')
# Maritime lighthouse.
for z in range(8):cylinder('Tower course',(0,0,z*1.8+.9),2.7-z*.09,1.8,white if z%3 else red)
cylinder('Lantern platform',(0,0,14.6),3.1,.35,white);cylinder('Lantern glazing',(0,0,15.8),1.8,2.2,glass)
for i in range(24):
 a=i*math.tau/24;box('Guardrail upright',(2.9*math.cos(a),2.9*math.sin(a),15.3),(.045,.045,1.2),white,.005)
cylinder('Lantern roof',(0,0,17.1),2.2,.25,red);export('lighthouse')
# Rural barn, slatted walls and fence.
box('Barn',(0,0,2.5),(12,8,5),green)
for x in range(-6,7):box('Board batten',(x,-4.03,2.5),(.045,.05,5),wood,.008)
for side in [-1,1]:
 o=box('Pitched roof',(side*3.3,0,5.8),(7.3,9,.2),roof);o.rotation_euler.y=side*.32
box('Barn door',(0,-4.1,1.8),(3.1,.13,3.6),wood)
for x in range(-10,11,2):box('Fence post',(x,-7,.7),(.13,.13,1.4),wall)
for z in [.4,1.1]:box('Fence rail',(0,-7,z),(20,.1,.12),wall)
export('barn')
# Coastal railway stop, platform, canopy, seats.
box('Station platform',(0,0,.5),(22,5,1),wall)
for x in [-8,-4,0,4,8]:box('Canopy column',(x,0,2.4),(.18,.18,3.8),green)
box('Station canopy',(0,0,4.4),(23,6,.24),green)
for x in [-6,0,6]:box('Platform bench',(x,1,1.1),(3,.65,.15),wood)
for y in [-4,-5.5]:box('Rail',(0,y,.13),(60,.09,.16),roof,.01)
for x in range(-29,30):box('Sleeper',(x,-4.75,.02),(.18,2.7,.15),wood,.01)
export('station')
bpy.context.window.scene=old
print('REGIONAL_ASSETS_COMPLETE')
