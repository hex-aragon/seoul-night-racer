"""Snapshot public OSM/OSRM road centerlines; never called by the deployed game."""
import json, pathlib, urllib.request, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
# Curated public scenic-road endpoints, longitude/latitude. Width/elevation are game design.
places=[
('seoul-bukak','서울 북악 스카이웨이','서울','forest',2,127.001,37.594,126.967,37.607,'pavilion'),
('seoul-hangang','서울 한강 강변','서울','riverside',4,126.934,37.527,126.989,37.514,'cafe'),
('seoul-jamsil','서울 잠실 호수길','서울','city',4,127.091,37.512,127.116,37.520,'pavilion'),
('seoul-seongsu','서울 성수 서울숲길','서울','city',2,127.033,37.544,127.064,37.542,'cafe'),
('incheon-yeongjong','인천 영종 해안길','인천','coast',4,126.570,37.492,126.620,37.492,'lighthouse'),
('incheon-songdo','인천 송도 센트럴파크','인천','city',6,126.634,37.389,126.667,37.382,'cafe'),
('incheon-ganghwa','인천 강화 해안길','인천','coast',2,126.487,37.646,126.507,37.691,'pavilion'),
('gapyeong-cheongpyeong','가평 청평호 호수길','가평','riverside',2,127.426,37.724,127.482,37.694,'cafe'),
('gapyeong-homyeong','가평 호명산 숲길','가평','forest',2,127.434,37.737,127.469,37.761,'pavilion'),
('gapyeong-bukhangang','가평 북한강 물길','가평','riverside',2,127.514,37.750,127.535,37.806,'cafe'),
('gangwon-gyeongpo','강릉 경포 해변길','강원','coast',2,128.896,37.796,128.923,37.771,'lighthouse'),
('gangwon-jeongdongjin','강릉 정동진 바닷길','강원','coast',2,129.031,37.691,129.038,37.656,'station'),
('gangwon-yangyang','양양 낙산 해변길','강원','coast',4,128.607,38.149,128.624,38.117,'cafe'),
('gangwon-daegwallyeong','대관령 고갯길','강원','pasture',2,128.706,37.674,128.743,37.695,'barn'),
('busan-dalmaji','부산 달맞이 해안길','부산','coast',2,129.172,35.160,129.202,35.180,'cafe'),
('busan-gwangalli','부산 광안리 바닷길','부산','coast',4,129.105,35.145,129.131,35.164,'lighthouse'),
('busan-songjeong','부산 송정 해변길','부산','coast',2,129.202,35.177,129.219,35.198,'station'),
('jeolla-damyang','담양 가로수길','전라도','forest',2,126.980,35.327,127.027,35.330,'pavilion'),
('jeolla-suncheon','순천만 들판길','전라도','pasture',2,127.485,34.900,127.502,34.860,'barn'),
('jeolla-yeosu','여수 돌산 바닷길','전라도','coast',2,127.758,34.728,127.795,34.700,'lighthouse'),
('jeolla-byeonsan','변산반도 해안길','전라도','coast',2,126.480,35.652,126.507,35.625,'cafe'),
('jeolla-jeonju','전주 한옥마을길','전라도','city',2,127.149,35.815,127.158,35.796,'hanok'),
('jeolla-jindo','진도 울돌목 바닷길','전라도','coast',2,126.302,34.570,126.323,34.563,'pavilion'),
('gangwon-chuncheon','춘천 의암호 호수길','강원','riverside',2,127.669,37.875,127.684,37.914,'cafe'),
]
out=ROOT/'public/maps';out.mkdir(exist_ok=True)
records=[]
for i,(id,name,region,theme,lanes,x,y,x2,y2,asset) in enumerate(places):
 file=out/(id+'.json')
 url=f'https://router.project-osrm.org/route/v1/driving/{x},{y};{x2},{y2}?overview=full&geometries=geojson'
 if file.exists(): route=json.loads(file.read_text())
 else:
  req=urllib.request.Request(url,headers={'User-Agent':'SeoulDrive-development/1.0'})
  with urllib.request.urlopen(req,timeout=40) as res: raw=json.load(res)
  assert raw['code']=='Ok',raw
  r=raw['routes'][0];route={'source':url,'attribution':'© OpenStreetMap contributors, ODbL 1.0; routing by OSRM','distance':r['distance'],'coordinates':r['geometry']['coordinates']}
  file.write_text(json.dumps(route,ensure_ascii=False));time.sleep(1.1)
 records.append({'id':id,'name':name,'region':region,'theme':theme,'lanes':lanes,'asset':asset,'coordinates':route['coordinates'],'distance':route['distance']})
 print(id,round(route['distance']),len(route['coordinates']),flush=True)
(ROOT/'app/korean-roads.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')))
