"""
제주 실제 지형(SRTM DEM)을 3D 로 만들어 '비스듬히 내려다본 지도 이미지'로 렌더링한다. (구름 없음, 지도 전용)
실행:  blender.exe -b --python tools/render_map.py
출력:  public/map/jeju-3d.jpg  (지도 이미지)
       public/map/jeju-3d.json (이미지 위 좌표 계산에 필요한 값 + 표고 격자)

핀을 정확히 올리려면 '직교(원근 없음) + 고정 기울기' 카메라를 쓴다.
  화면 x(px) = W/2 + (x_km - cx) * s
  화면 y(px) = H/2 - ((y_km - cy) * cos(tilt) + z_km * sin(tilt)) * s
  (x,y: 경위도를 km 로 바꾼 값, z: 표고(km) * EXAG, s = W / 이미지 가로폭(km))
"""
import gzip
import json
import math
import os

import bpy
import mathutils
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEM_PATH = os.environ.get('DEM_PATH', r'C:\vibe\day4\dem\N33E126.hgt.gz')
OUT_DIR = os.path.join(ROOT, 'public', 'map')
os.makedirs(OUT_DIR, exist_ok=True)

EXAG = 3.0            # 높이 과장 배율 (3D 느낌을 살림)
STRIDE = 2            # DEM 60m 간격
PX_KM = 0.03 * STRIDE
TILT = 45.0           # 카메라 기울기(0=수직 위에서, 클수록 비스듬)
W = 4800              # 이미지 가로(px) - 크게 확대해도 선명하도록

# ---------------------------------------------------------------- DEM ----
with gzip.open(DEM_PATH, 'rb') as f:
    dem = np.frombuffer(f.read(), '>i2').reshape(3601, 3601).astype(np.float32)
LON0, LAT_TOP = 126.0, 34.0
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = 126.12, 127.0, 33.10, 33.60
c0, c1 = int((LON_MIN - LON0) * 3600), int((LON_MAX - LON0) * 3600)
r0, r1 = int((LAT_TOP - LAT_MAX) * 3600), int((LAT_TOP - LAT_MIN) * 3600)
sub = dem[r0:r1 + 1:STRIDE, c0:c1 + 1:STRIDE]
sub = np.where(sub < -1000, 0, sub)
rows, cols = sub.shape

CLON, CLAT = 126.55, 33.38
KX = 111.32 * math.cos(math.radians(CLAT))
KY = 111.32
lons = LON0 + (c0 + np.arange(cols) * STRIDE) / 3600
lats = LAT_TOP - (r0 + np.arange(rows) * STRIDE) / 3600
X, Y = np.meshgrid((lons - CLON) * KX, (lats - CLAT) * KY)
land = sub > 1.0


def fbm(shape, beta, seed):
    w = np.random.default_rng(seed).standard_normal(shape).astype(np.float32)
    f = np.sqrt(np.fft.fftfreq(shape[0])[:, None] ** 2 + np.fft.fftfreq(shape[1])[None, :] ** 2)
    f[0, 0] = 1
    a = f ** (-beta / 2)
    a[0, 0] = 0
    n = np.real(np.fft.ifft2(np.fft.fft2(w) * a))
    return n / n.std()


def blur(a, sigma_km):
    s = sigma_km / PX_KM
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.fftfreq(a.shape[1])[None, :]
    g = np.exp(-2 * (np.pi * s) ** 2 * (fy ** 2 + fx ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


# 산 굴곡 디테일(작은 능선/골짜기)
elev_km = np.clip(sub, 0, None) / 1000
gy_, gx_ = np.gradient(np.clip(sub, 0, None), PX_KM * 1000)
slope = np.clip(np.hypot(gx_, gy_), 0, 0.6)
detail = 0.6 * fbm(sub.shape, 2.6, 1) + 0.3 * fbm(sub.shape, 1.8, 2) - 0.35 * np.abs(fbm(sub.shape, 2.2, 3))
amp = (0.010 + 0.045 * np.clip(elev_km / 1.9, 0, 1) ** 0.8) * (0.5 + 1.2 * slope)
Z = np.where(land, np.maximum(sub / 1000 * EXAG + detail * amp, 0.004), 0.0)   # 바다는 z=0 평면

# ------------------------------------------------------------ 정점 색 ----
stops_m = [0, 60, 300, 700, 1200, 1700, 1950]
stops_rgb = np.array([
    (0.80, 0.86, 0.55),   # 해안/들판: 연한 연두
    (0.60, 0.78, 0.38),
    (0.40, 0.67, 0.32),
    (0.28, 0.55, 0.28),
    (0.22, 0.44, 0.25),   # 한라산 숲
    (0.52, 0.49, 0.41),   # 정상부 바위
    (0.66, 0.62, 0.54),
])
e = np.clip(sub, 0, None)
land_rgb = np.stack([np.interp(e, stops_m, stops_rgb[:, k]) for k in range(3)], axis=-1)
patch = np.clip(fbm(sub.shape, 2.0, 7), -2, 2)[..., None]
land_rgb = land_rgb * (1 + 0.09 * patch)                                  # 밭/숲 얼룩
rock = np.clip((slope - 0.22) / 0.30, 0, 1)[..., None] * 0.55             # 급경사는 바위색
land_rgb = land_rgb * (1 - rock) + np.array([0.46, 0.43, 0.38]) * rock

near = blur(land.astype(np.float32), 2.5)
depth = np.clip(near * 2.4, 0, 1)[..., None]
deep, shallow = np.array([0.05, 0.34, 0.60]), np.array([0.28, 0.80, 0.80])
sea_rgb = deep * (1 - depth) + shallow * depth
foam = np.clip((blur(land.astype(np.float32), 0.45) - 0.18) / 0.22, 0, 1)[..., None]
sea_rgb = sea_rgb * (1 - 0.75 * foam) + np.array([1, 1, 1]) * 0.75 * foam

rgb = np.where(land[..., None], land_rgb, sea_rgb)
rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones(rgb.shape[:2] + (1,))], axis=-1).astype(np.float32)

# ---------------------------------------------------------------- 장면 ----
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'Standard'

verts = np.stack([X, Y, Z], axis=-1).reshape(-1, 3).astype(np.float32)
idx = np.arange(rows * cols).reshape(rows, cols)
quads = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], axis=-1).reshape(-1, 4)
mesh = bpy.data.meshes.new('JejuTerrain')
mesh.vertices.add(len(verts))
mesh.vertices.foreach_set('co', verts.ravel())
mesh.loops.add(len(quads) * 4)
mesh.loops.foreach_set('vertex_index', quads.ravel())
mesh.polygons.add(len(quads))
mesh.polygons.foreach_set('loop_start', np.arange(0, len(quads) * 4, 4))
mesh.polygons.foreach_set('loop_total', np.full(len(quads), 4))
mesh.polygons.foreach_set('use_smooth', np.ones(len(quads), dtype=bool))
mesh.update(calc_edges=True)
col = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
col.data.foreach_set('color', rgba.reshape(-1, 4).ravel())
terrain = bpy.data.objects.new('Jeju', mesh)
scene.collection.objects.link(terrain)

mat = bpy.data.materials.new('MapMat')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.92
attr = nt.nodes.new('ShaderNodeAttribute')
attr.attribute_name = 'Col'
nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
terrain.data.materials.append(mat)

# 빛: 북서쪽 위에서 비추는 전통적인 지형 음영(hillshade)
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.80, 0.88, 1.0, 1)
bg.inputs['Strength'].default_value = 0.32
az, el = math.radians(315), math.radians(32)
L = mathutils.Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
sd = bpy.data.lights.new('Sun', 'SUN')
sd.energy = 2.3
sd.angle = math.radians(2.0)
sd.color = (1.0, 0.97, 0.90)
sun = bpy.data.objects.new('Sun', sd)
scene.collection.objects.link(sun)
sun.rotation_euler = L.to_track_quat('Z', 'Y').to_euler()

# ------------------------------------------------------------- 카메라 ----
x_min, x_max = float(X.min()), float(X.max())
y_min, y_max = float(Y.min()), float(Y.max())
cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2
width_km = x_max - x_min
t = math.radians(TILT)
s_px = W / width_km                                     # px / km
v_half = (y_max - y_min) / 2 * math.cos(t)              # 세로 반폭(km)
H = int(math.ceil(2 * v_half * s_px / 10) * 10)         # 10px 단위로 올림

cam_data = bpy.data.cameras.new('Cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = width_km
cam_data.clip_start, cam_data.clip_end = 1, 1000
cam = bpy.data.objects.new('Cam', cam_data)
scene.collection.objects.link(cam)
D = 300.0
cam.location = (cx, cy - D * math.sin(t), D * math.cos(t))
cam.rotation_euler = (t, 0, 0)
scene.camera = cam

scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.eevee.taa_render_samples = 48
scene.eevee.use_shadows = True
img = scene.render.image_settings
img.file_format = 'JPEG'
img.quality = 86
scene.render.filepath = os.path.join(OUT_DIR, 'jeju-3d.jpg')
bpy.ops.render.render(write_still=True)
print('rendered', W, 'x', H)

# ----------------------------------------------------- 표고 격자(핀 높이용) ----
STEP = 0.005
g_lons = np.arange(LON_MIN, LON_MAX + 1e-9, STEP)
g_lats = np.arange(LAT_MIN, LAT_MAX + 1e-9, STEP)         # 남 -> 북
ci = np.clip(np.round(((g_lons - LON0) * 3600 - c0) / STRIDE).astype(int), 0, cols - 1)
ri = np.clip(np.round(((LAT_TOP - g_lats) * 3600 - r0) / STRIDE).astype(int), 0, rows - 1)
elev_grid = np.clip(sub[np.ix_(ri, ci)], 0, None).round().astype(int)

meta = {
    'image': '/map/jeju-3d.jpg',
    'width': W,
    'height': H,
    'tiltDeg': TILT,
    'exag': EXAG,
    'widthKm': width_km,
    'cx': cx,
    'cy': cy,
    'kx': KX,
    'ky': KY,
    'clon': CLON,
    'clat': CLAT,
    'bounds': {'lonMin': LON_MIN, 'lonMax': LON_MAX, 'latMin': LAT_MIN, 'latMax': LAT_MAX},
    'elev': {
        'lon0': LON_MIN,
        'lat0': LAT_MIN,
        'step': STEP,
        'cols': int(len(g_lons)),
        'rows': int(len(g_lats)),
        'data': elev_grid.ravel().tolist(),
    },
}
with open(os.path.join(OUT_DIR, 'jeju-3d.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, separators=(',', ':'))
print('meta written', os.path.getsize(os.path.join(OUT_DIR, 'jeju-3d.json')), 'bytes')
