"""Build editable pixel SVG equipment and identical PNG fallback atlases.

Each PNG has four direction groups (right, back, left, front), with one idle
and six walking cells. Coordinates share the original 100px character anchor.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageOps, ImageColor
import math
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/appearance'
INK = '#35445d'
GOLD = '#eab84e'


class Pen:
    def __init__(self):
        self.im = Image.new('RGBA', (100, 100))
        self.d = ImageDraw.Draw(self.im)

    def poly(self, pts, color, edge=INK):
        mask=Image.new('L',(100,100)); ImageDraw.Draw(mask).polygon(pts,fill=255)
        self.surface(mask,color)
        if edge:
            self.d.line(pts + [pts[0]], fill=self.outline(color,edge), width=1)

    def box(self, xy, color, edge=None):
        if xy[2]-xy[0]>3 and xy[3]-xy[1]>3:
            mask=Image.new('L',(100,100));ImageDraw.Draw(mask).rectangle(xy,fill=255)
            self.surface(mask,color)
            if edge:self.d.rectangle(xy,outline=self.outline(color,edge))
        else:self.d.rectangle(xy, fill=color, outline=edge)

    def oval(self, xy, color, edge=INK):
        mask=Image.new('L',(100,100)); ImageDraw.Draw(mask).ellipse(xy,fill=255)
        self.surface(mask,color)
        if edge: self.d.ellipse(xy,outline=self.outline(color,edge))

    def outline(self,color,edge):
        if edge!=INK: return edge
        rgb=ImageColor.getrgb(color)
        return tuple(round(c*.48) for c in rgb)+(255,)

    def surface(self,mask,color):
        # Discrete material-local shading, not a filter over the finished sprite.
        # Rounded upper-left highlights and a darker lower-right rim match the
        # character's volume while retaining exact pixel edges and transparency.
        box=mask.getbbox()
        if not box: return
        x0,y0,x1,y1=box; w=max(1,x1-x0);h=max(1,y1-y0)
        rgb=ImageColor.getrgb(color); pixels=self.im.load(); m=mask.load()
        for y in range(y0,y1):
            for x in range(x0,x1):
                if not m[x,y]: continue
                u=(x-x0)/w;v=(y-y0)/h
                light=.95+.22*math.exp(-((u-.3)**2+(v-.22)**2)*9)-.22*v-.06*u
                # Six discrete shades, shared by every material. No smooth SVG
                # gradients: each output rectangle occupies an integer pixel.
                light=round(light*6)/6
                pixels[x,y]=tuple(min(255,round(c*light + max(0,light-1)*100)) for c in rgb)+(255,)

    def feather(self,pts,color):
        # Quadratic curves around the tip replace angular fan blades.
        a,b,tip,c,d=pts
        path=[a,b]
        for i in range(1,9):
            t=i/8;path.append((round((1-t)**2*b[0]+2*(1-t)*t*tip[0]+t*t*c[0]),round((1-t)**2*b[1]+2*(1-t)*t*tip[1]+t*t*c[1])))
        path += [d]
        self.poly(path,color)

    def line(self, pts, color, width=1):
        self.d.line(pts, fill=color, width=width)

    def gem(self, x, y, color='#80e4ee', size=4):
        self.poly([(x, y-size), (x+size, y), (x, y+size), (x-size, y)], color)
        self.line([(x-size+1,y),(x,y-size+1),(x,y+1)], '#eefeff')

    def star(self, x, y, r=5, color='#fff0a3'):
        self.poly([(x,y-r),(x+2,y-2),(x+r,y),(x+2,y+2),(x,y+r),(x-2,y+2),(x-r,y),(x-2,y-2)],color,'#ad874d')


def hat(p, n, side, rear, phase):
    # Side silhouettes are drawn in profile; rear views have no front jewel/visor.
    if n in (1,4,6):
        color={1:'#61badb',4:'#57b388',6:'#9b7bc4'}[n]
        p.line([(33,36),(36,33),(64,33),(67,36)], INK, 3)
        p.line([(34,35),(38,34),(63,34),(66,35)], color, 2)
        if rear:
            p.box((47,32,53,36), '#debd67', INK)
            p.line([(48,37),(45,43)],color,2); p.line([(52,37),(55,41)],color,2)
        elif side:
            x=63
            if n==1: p.star(x,32,5)
            elif n==4:
                p.poly([(59,33),(60,24),(65,27),(66,33)], '#75d59d')
                p.gem(64,32,'#79e9b5',3)
            else:
                p.poly([(59,34),(58,24),(62,27),(65,21),(67,32)],color)
                p.gem(64,30,'#debbff',3)
        else:
            if n==1:
                p.star(50,31,7); p.gem(50,31,'#81e8ff',3)
            elif n==4:
                for x,s in [(36,1),(64,-1)]:
                    p.poly([(x,33),(x-4*s,25),(x+3*s,28),(x+6*s,33)],'#83cc82')
                p.gem(50,31,'#6be6b7',6)
            else:
                for x,h in [(39,7),(50,13),(61,7)]:
                    p.poly([(x-3,34),(x-3,28),(x,34-h),(x+3,28),(x+3,34)],color)
                    p.line([(x-1,31),(x,36-h)],'#e5c9ff')
    elif n==3:
        pts=[(34,34),(33,23),(40,28),(43,20),(50,27),(57,20),(60,28),(67,23),(66,34)]
        if side: pts=[(34,34),(35,24),(43,27),(48,19),(53,27),(62,22),(66,25),(65,34)]
        p.poly(pts,GOLD,'#7b6037'); p.box((35,32,65,36),'#ca8e38','#7b6037')
        p.line([(36,33),(64,33)],'#ffeda1')
        if not rear:
            for x in ([61] if side else [40,50,60]): p.gem(x,34,'#ee797d',2)
        else: p.box((47,33,53,35),'#ffe096')
    elif n==5:
        if side:
            p.poly([(37,31),(36,14),(42,12),(48,31)],'#e0b8b2')
            p.poly([(50,29),(49,8),(55,10),(59,33)],'#f0d8ca')
            p.poly([(52,27),(52,13),(54,14),(56,29)],'#dd91a7',None)
        else:
            for x,s in [(35,1),(65,-1)]:
                p.poly([(x-5*s,33),(x-6*s,12),(x-2*s,9),(x+5*s,18),(x+7*s,32)],'#ecd2c2')
                if not rear: p.poly([(x-2*s,29),(x-3*s,15),(x+2*s,20),(x+3*s,29)],'#de96ab',None)
                p.box((min(x-4*s,x+3*s),30,max(x-4*s,x+3*s),32),'#fff0d9')
        p.line([(34,33),(42,31),(59,31),(66,34)], '#b98793',2)
    elif n==2:
        p.poly([(31,42),(30,31),(34,23),(43,20),(59,20),(68,28),(69,42),(63,47),(59,37),(40,37),(37,47)],'#5d839c')
        p.poly([(34,30),(40,23),(58,23),(65,29),(65,33),(35,33)],'#aac8cf')
        p.line([(40,24),(56,24),(61,27)],'#e4f2e6')
        if rear:
            p.box((37,34,63,42),'#7396a8',INK)
            for x in [42,47,52,57]: p.box((x,36,x+1,40),'#344e68')
        elif side:
            p.box((57,33,68,38),'#314b64',INK); p.line([(59,34),(65,34)],'#84e7ed',2)
            p.oval((33,31,44,43),'#c4ae67'); p.oval((36,34,41,39),'#516a81')
        else:
            p.box((36,33,64,38),'#304c64',INK); p.line([(39,34),(60,34)],'#74dfea',2)
            for x in [32,65]: p.box((x,34,x+3,41),'#d2ae59',INK)
    else:
        # Knight helmet: crest and cheek plates, distinct from the robot helmet.
        p.poly([(32,41),(33,29),(39,23),(61,23),(67,30),(68,41),(63,46),(60,35),(40,35),(37,46)],'#acbfc8')
        p.poly([(36,29),(42,25),(58,25),(63,30)],'#eaf4e8',None)
        if side:
            p.poly([(42,24),(42,15),(48,13),(57,16),(61,24)],'#6086c0')
            p.line([(44,17),(55,17)],'#9dcbed',2)
            p.box((58,32,67,35),'#5e758b'); p.box((36,33,42,42),'#889ead',INK)
        else:
            p.poly([(46,25),(46,14),(50,10),(54,14),(54,25)],'#597cb4')
            p.line([(49,14),(49,23)],'#a7daf0',2)
            if rear: p.line([(38,34),(62,34)],'#6b8495',3)
            else:
                p.line([(38,32),(45,32)],'#3e566e',2); p.line([(55,32),(62,32)],'#3e566e',2)


def ice_wing(p,side,rear,phase):
    # Approved pixel SVG design. Side feathers fold behind the shoulder instead
    # of squeezing or stretching a front image. Coordinates stay on the grid.
    feathers=[[(44,58),(37,52),(31,44),(26,35),(23,27),(23,23),(21,23),(19,26),(19,34),(21,42),(25,50),(31,56),(38,60)],
      [(43,59),(34,56),(26,51),(19,44),(15,37),(13,35),(12,38),(13,45),(17,52),(24,58),(32,62),(40,62)],
      [(43,61),(34,61),(25,58),(17,53),(12,49),(10,49),(11,54),(15,60),(22,65),(30,67),(38,66)],
      [(43,63),(33,66),(24,65),(18,62),(16,63),(19,68),(25,71),(32,72),(39,69),(45,66)]]
    palette=['#31567c','#467fa8','#66aac8','#90d0df','#b9e7e9','#def7ef','#f5fff3']
    left=Image.new('RGBA',(100,100))
    def project(points):
        if not side:return points
        return [(round(36+(x-44)*.78),round(y+(44-x)*.08)) for x,y in points]
    def shape(points):
        points=project(points);mask=Image.new('L',(100,100));ImageDraw.Draw(mask).polygon(points,fill=255)
        x0,y0,x1,y1=mask.getbbox();pixels=left.load();m=mask.load()
        for y in range(y0,y1):
            for x in range(x0,x1):
                if m[x,y]:
                    u=(x-x0)/max(1,x1-x0);v=(y-y0)/max(1,y1-y0)
                    i=max(1,min(6,round(3+2.4*math.exp(-((u-.32)**2+(v-.23)**2)*7)-1.7*v)))
                    pixels[x,y]=ImageColor.getrgb(palette[i])+(255,)
        ImageDraw.Draw(left).line(points+[points[0]],fill=palette[0])
    for points in feathers:shape(points)
    d=ImageDraw.Draw(left)
    for points in [[(21,28),(22,35),(25,43),(30,50)],[(14,39),(17,46),(23,53),(30,57)],[(13,53),(19,59),(26,63)],[(21,66),(27,69),(32,69)]]:
        d.line(project(points),fill='#dcf8ee')
    for points in [[(38,54),(35,48),(32,46),(30,47),(31,51),(36,57)],[(42,58),(38,52),(35,51),(34,53),(36,57),(40,61)],[(45,62),(42,56),(39,56),(38,58),(40,62),(44,65)]]:shape(points)
    d=ImageDraw.Draw(left);points=project([(40,58),(43,56),(47,59),(48,63),(45,67),(41,65),(39,61)])
    d.polygon(points,fill='#d6ad5f');d.line(points+[points[0]],fill='#856346')
    d.line(project([(40,59),(43,57),(46,59)]),fill='#fff0ae')
    d.polygon(project([(43,59),(46,61),(45,64),(42,63),(41,61)]),fill='#4b8ebe')
    d.line(project([(43,59),(44,60),(42,62)]),fill='#b4f7ed')
    p.im.alpha_composite(left)
    if not side:p.im.alpha_composite(ImageOps.mirror(left))
    if rear:
        p.line([(46,61),(54,61)],'#856346',3);p.gem(50,61,'#8adcdf',3)


def wing(p,n,side,rear,phase):
    # Distinct folded profiles, never a widened front sprite.
    flutter=1 if phase in (2,3) else 0
    if n==1:
        ice_wing(p,side,rear,phase)
        return
    if side:
        if n==1:
            for pts,col in [([(43,53),(32,23),(25,18),(27,45)],'#8bdbe9'), ([(40,57),(21,34),(15,33),(23,55)],'#b3edf1'), ([(39,59),(20,53),(16,59),(32,65)],'#60b7d4')]:
                p.poly(pts,col); p.line([pts[0],pts[1]],'#efffff')
        elif n==2:
            p.poly([(44,59),(38,24),(30,18),(29,31),(19,32),(24,45),(16,52),(29,57),(30,67)],'#8e648e')
            p.line([(42,57),(31,30),(24,37)],'#d9a5b6',2)
            p.line([(32,32),(26,49),(30,61)],'#49354f')
        elif n==3:
            for i in range(5):
                p.feather([(43,60),(28-i*2,24+i*5),(20-i*2,20+i*5),(23-i,49+i*2),(35,65)],'#e8ebdf')
                p.line([(40,59),(26-i*2,32+i*5)],'#bdced4')
        else:
            p.poly([(43,58),(38,32),(23,23),(18,28),(29,43),(23,57),(30,64)],'#bd9c57')
            for i in range(3): p.poly([(30,37+i*7),(17,31+i*8),(16,36+i*8),(28,44+i*7)],'#d8c688')
            p.oval((31,43,41,53),'#5a7a8c'); p.oval((34,46,38,50),'#8bf0ef')
    else:
        for s in [-1,1]:
            def pts(a): return [(50+s*x,y+flutter) for x,y in a]
            if n==1:
                for a,col in [([(4,55),(22,19),(31,16),(24,44)],'#a3e7ef'), ([(6,58),(34,31),(42,34),(28,54)],'#78cbdc'), ([(7,61),(36,51),(39,58),(20,68)],'#b0ecf0')]:
                    p.poly(pts(a),col); p.line(pts([a[0],a[1]]),'#efffff')
            elif n==2:
                p.poly(pts([(5,57),(18,28),(32,18),(30,32),(42,32),(34,43),(41,53),(28,53),(26,66),(16,59)]),'#977498')
                p.line(pts([(5,57),(21,34),(31,22)]),'#d0a3b8',2)
                for end in [(38,34),(36,51),(25,62)]: p.line(pts([(21,34),end]),'#57415f')
            elif n==3:
                for i in range(5):
                    a=[(5,60),(22+i*3,26+i*5),(31+i*2,20+i*7),(32+i*2,25+i*7),(20,59+i*2),(10,65)]
                    p.feather(pts([a[0],a[1],a[2],a[3],a[5]]),'#eeefe2'); p.line(pts([(9,60),(27+i*3,30+i*6)]),'#bdced4')
            else:
                p.poly(pts([(5,58),(15,30),(30,24),(34,29),(23,42),(27,60),(17,65)]),'#b69353')
                for i in range(3): p.poly(pts([(20,37+i*7),(38,29+i*8),(40,34+i*8),(23,44+i*7)]),'#e6cf8a')
                p.oval((50+s*14-5,45,50+s*14+5,55),'#546e83'); p.oval((50+s*14-2,48,50+s*14+2,52),'#8beced')
        if rear:
            p.poly([(45,50),(50,46),(55,50),(55,60),(50,64),(45,60)],'#bda366')
            p.gem(50,54,'#91dce3',3)


def backgear(p,n,side,rear,phase):
    if side: # Attach to the back, opposite the face.
        x=27
    else: x=50
    if n==2:
        w=6 if side else 13
        p.box((x-w,51,x+w,74),'#a97148',INK)
        p.box((x-w+2,55,x+w-2,70),'#c99761')
        p.oval((x-w-2,48,x+w+2,57),'#79a5a0')
        p.line([(x-w+2,50),(x+w-2,50)],'#b1d1b4',2)
        if not side:
            p.box((x-8,63,x+8,72),'#8d6349',INK); p.box((x-2,64,x+2,67),'#f1d380')
            for sx in [x-9,x+8]: p.line([(sx,55),(sx,61)],'#e5c79a',2)
        else: p.box((x-3,61,x+2,69),'#cfb385',INK)
    elif n==1:
        p.poly([(x-8,49),(x+7,49),(x+13,73),(x+7,79),(x,74),(x-8,78),(x-14,73)],'#ae556c')
        p.poly([(x-3,53),(x+4,54),(x+8,72),(x+2,70)],'#d58289',None)
        p.line([(x-7,72),(x,70),(x+8,73)],'#e8bc77',2)
        if not side: p.gem(x,60,'#ecc779',3)
    elif n==3:
        p.line([(x+6,72),(x+6,21)],'#4f5265',3)
        p.poly([(x+7,23),(x-12,23),(x-15,39),(x-7,43),(x+7,38)],'#426d9f')
        p.line([(x-11,25),(x+4,25)],'#dfbd6b',2)
        p.star(x-4,32,4)
        p.gem(x+6,20,'#e5c366',2)
    else:
        for s in [-1,1]:
            p.poly([(x,58),(x+s*12,48),(x+s*16,51),(x+s*13,60),(x+s*17,68),(x+s*7,70),(x,62)],'#b783b9')
            p.oval((x+s*10-2,53,x+s*10+2,57),'#f6d8e2')
        p.gem(x,59,'#ffd89d',3)
        p.line([(x-2,64),(x-5,78)],'#ddbb8c',2); p.line([(x+2,64),(x+6,76)],'#ddbb8c',2)


def hand(p,n,side,rear,phase):
    x=67 if side else 70 if not rear else 30
    p.line([(x,78),(x,42)],INK,4)
    p.line([(x-1,77),(x-1,42)],'#b5a171' if n in (1,2) else '#8cb9d0',2)
    p.box((x-2,65,x+1,69),'#705973')
    if n==1:
        p.oval((x-6,33,x+5,44),'#79c4a7'); p.oval((x-2,34,x+8,40),'#88d9b6')
        p.oval((x,35,x+5,38),'#d2f1be',None); p.gem(x,46,'#f0c776',2)
    elif n in (2,3):
        color='#e9c267' if n==2 else '#a5e4f1'
        p.line([(x-7,32),(x-7,43),(x,48),(x+7,43),(x+7,32)],INK,4)
        p.line([(x-7,33),(x-7,42),(x,46),(x+7,42),(x+7,33)],color,2)
        p.line([(x,47),(x,28)],color,3)
        for sx in [x-7,x,x+7]:
            if n==3: p.gem(sx,31 if sx!=x else 27,'#c8f8ff',3)
            else: p.poly([(sx-2,34),(sx,28 if sx!=x else 24),(sx+2,34)],'#ffe8a1')
        if n==3: p.gem(x,47,'#87bbed',3)
    else:
        p.oval((x-8,29,x+8,45),'#7c7bb0'); p.oval((x-6,31,x+6,43),'#d9d3f1')
        p.star(x,36,7); p.gem(x,36,'#ddfaff',2)
        p.line([(x-4,47),(x-6,56)],'#df9faa',2)


def boots(p,n,side,rear,phase):
    # Original feet span y=73..79; narrow profile, separate walking feet.
    colors={1:('#74abc6','#c8e8e9'),2:('#728c9e','#b8cbd0'),3:('#9274ae','#dcacca')}
    base,light=colors[n]
    for x,y in ([(46,73),(53,74)] if side else [(39,73),(53,73)]):
        y += 1 if phase in (2,3) and x<50 else 0
        p.poly([(x,y),(x+8,y),(x+8,y+4),(x+11,y+5),(x+11,y+8),(x-1,y+8),(x-1,y+3)],base)
        p.line([(x+1,y+1),(x+6,y+1)],light,2)
        p.line([(x,y+7),(x+10,y+7)],'#3c4b64')
        if n==1: p.star(x+4,y+4,2)
        elif n==2:
            p.box((x,y+3,x+7,y+4),'#40576b'); p.box((x+5,y+3,x+7,y+3),'#a7eee9')
        else:
            for i,col in enumerate(['#83ced8','#ead38e','#dc9ab6']): p.box((x+i*3,y+5,x+i*3+2,y+6),col)


def mount(p,n,side,rear,phase):
    # Saddle sits behind the original feet; all faces turn with the rider.
    if n==1:
        p.oval((24,67,76,95),'#58afca','#3a758f')
        p.oval((27,68,73,90),'#8cdae3',None); p.oval((31,69,69,85),'#b2ece9',None)
        p.oval((29,74,38,78),'#e3fff0',None)
        if side: p.oval((63,83,68,88),'#355874'); p.box((64,83,65,84),'#fffbe2')
        elif not rear:
            for x in [39,57]: p.oval((x,84,x+4,88),'#355874'); p.box((x+1,84,x+2,85),'#effff6')
            p.line([(47,90),(50,91),(53,90)],'#527795')
        else: p.oval((45,87,55,92),'#a4ebeb','#609fb4')
    elif n==2:
        p.poly([(24,78),(29,68),(40,64),(50,69),(60,64),(71,68),(77,78),(73,88),(60,94),(50,96),(39,93),(28,88)],'#eb97a1','#a76b80')
        p.oval((29,69,51,88),'#f5bdb3',None); p.oval((52,69,72,87),'#f5b2ae',None)
        p.line([(50,72),(49,84),(50,92)],'#c77f91')
        p.poly([(49,70),(48,62),(59,60),(66,62),(58,67)],'#80b87d','#4a816b')
        p.line([(51,65),(61,62)],'#c8da94')
        if side:
            p.oval((66,80,69,84),'#6c4b67'); p.oval((65,86,70,88),'#ef768b',None)
        elif not rear:
            for x in [37,60]: p.oval((x,80,x+3,84),'#6c4b67'); p.box((x,85,x+4,86),'#e77f94')
        else: p.line([(43,92),(50,94),(57,92)],'#ffc5b2')
    elif n==3:
        for x in [25,65]:
            p.oval((x,81,x+10,96),'#40546a'); p.oval((x+2,84,x+8,93),'#8296a4')
        p.oval((23,65,77,94),'#7596a4'); p.oval((28,67,72,88),'#b9cbd0')
        p.line([(34,69),(42,68),(58,68),(66,71)],'#e9ecdc',2)
        if side:
            p.box((62,77,76,85),'#3d5f77',INK); p.box((65,78,72,80),'#87ece5')
            p.oval((30,74,45,88),'#667f91'); p.oval((33,77,42,85),'#d1b86c')
        elif rear:
            p.box((36,76,64,86),'#526f84',INK)
            for x in [40,46,52,58]: p.line([(x,78),(x,83)],'#b0cbd2',2)
            p.box((46,88,54,90),'#ddae69')
        else:
            p.box((32,77,68,86),'#3c5c74',INK)
            for x in [37,55]: p.box((x,79,x+6,81),'#9af6e8')
            p.box((44,89,56,91),'#ddbc6c')
    else:
        p.poly([(22,85),(25,76),(36,71),(43,66),(56,66),(64,71),(75,76),(78,85),(72,93),(28,93)],'#e8c994','#9d7c59')
        p.oval((28,74,71,88),'#fae6b5',None)
        p.poly([(40,74),(38,66),(43,60),(48,64),(54,59),(60,64),(59,71),(65,73)],'#fff1ce','#bca276')
        p.line([(42,69),(47,71),(56,68)],'#e1ba84')
        if side:
            p.box((64,81,66,84),'#7b5b51'); p.box((66,86,69,87),'#e5a18b')
        elif not rear:
            p.box((37,82,39,85),'#7b5b51'); p.box((60,82,62,85),'#7b5b51')
            p.line([(47,88),(51,89),(55,88)],'#bb9371')
        else: p.line([(35,82),(48,86),(63,81)],'#d7b881',2)


def aura(p,n,side,rear,phase):
    colors={1:'#e9ca75',2:'#dd8762',3:'#7fcfdf',4:'#b798ca'}
    p.d.ellipse((23,82,77,94),outline=colors[n],width=1)
    if n==1:
        for x,y in [(26,86),(50,93),(74,86)]: p.star(x,y,3)
    elif n==2:
        for x,y in [(26,85),(40,92),(61,92),(74,85)]: p.poly([(x-3,y),(x-2,y-4),(x,y-7),(x+1,y-3),(x+3,y)],'#e8ac73','#ba775d')
    elif n==3:
        for x,y in [(26,86),(41,93),(59,93),(74,86)]: p.gem(x,y,'#b5f0f1',3)
    else:
        for x,y in [(27,88),(45,94),(68,90)]: p.line([(x-3,y),(x-4,y-2),(x-2,y-4),(x+2,y-4),(x+3,y-2)],'#c9b0dd',2)


PARTS={'accessory':(7,hat),'wings':(4,wing),'back':(4,backgear),'held':(4,hand),'shoes':(3,boots),'mount':(4,mount),'aura':(4,aura)}
NAMES={
 'accessory':['星石头环','机甲头盔','金色冠饰','翡翠头环','绒耳发饰','紫晶头环','银色头盔'],
 'wings':['冰晶羽翼','暮夜蝠翼','星辉羽翼','鎏金机械翼'],
 'back':['绯红披风','旅行行囊','星纹战旗','蝶结背饰'],
 'held':['如意长杖','金光三叉','冰晶三叉','星辉长杖'],
 'shoes':['星光靴','机甲战靴','幻彩战靴'],
 'mount':['水灵泡泡','蜜桃泡泡','机甲团团','奶油糖包'],
 'aura':['星辉环','暖焰环','冰晶环','紫雾环'],
}


def pixel_svg(atlas,title):
    """Emit actual SVG pixel rectangles, not an embedded PNG data URL.

    Group each facing/frame for editing; deduplicate identical frames with use.
    No smoothing, filters, gradients or external references are required.
    """
    groups=[];placements=[];seen={}
    directions=['right','back','left','front']
    for direction in range(4):
        for frame in range(7):
            index=direction*7+frame
            cell=atlas.crop((index*100,0,index*100+100,100))
            data=cell.tobytes();gid=seen.get(data)
            if gid is None:
                gid=f'{directions[direction]}-{frame}';seen[data]=gid;rects=[]
                for y in range(100):
                    x=0
                    while x<100:
                        color=cell.getpixel((x,y));end=x+1
                        while end<100 and cell.getpixel((end,y))==color:end+=1
                        if color[3]:
                            fill='#%02x%02x%02x'%color[:3]
                            rects.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{fill}"/>')
                        x=end
                groups.append(f'<g id="{gid}">'+''.join(rects)+'</g>')
            placements.append(f'<use href="#{gid}" x="{index*100}"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="2800" height="100" '
            'viewBox="0 0 2800 100" shape-rendering="crispEdges">'
            f'<title>{escape(title)} · 四方向像素装扮</title><defs>'+''.join(groups)+'</defs>'+''.join(placements)+'</svg>')

manifest_path=ROOT/'public/assets/manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
for key in list(manifest):
    if key.startswith('dress-'):
        del manifest[key]  # Retain original files, but no longer load unused legacy parts.
for slot,(count,fn) in PARTS.items():
    for n in range(1,count+1):
        atlas=Image.new('RGBA',(2800,100))
        for direction in range(4):
            for phase in range(7):
                pen=Pen(); fn(pen,n,direction in (0,2),direction==1,phase)
                cell=ImageOps.mirror(pen.im) if direction==2 else pen.im
                # One-pixel gait. No continuous scaling or subpixel blur.
                bob=1 if phase in (2,3) and slot not in ('aura','shoes') else 0
                atlas.alpha_composite(cell,(100*(direction*7+phase),bob))
        name=f'wardrobe-{slot}-{n}'
        atlas.save(OUT/f'{name}.png')
        (OUT/f'{name}.svg').write_text(pixel_svg(atlas,NAMES[slot][n-1]),encoding='utf-8')
        manifest[name]={'src':f'/assets/appearance/{name}.svg','w':100,'h':100,'frames':28,'duration':100}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built 30 pixel SVG atlases and PNG fallbacks: 4 directions, 7 frames each.')
