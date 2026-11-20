"""
Modelos 3D de objetos sublimados, construidos en código (sin IA): taza de 11 oz y plancha de metal
20 x 30 cm. Salen en web/public/models como .glb con un material "imprimible" (lo que se tiñe con el
color y recibe el estampado) y coordenadas de textura (TEXCOORD_0, origen arriba a la izquierda):

El patrón sigue la cuadrícula 2×2 de los maniquíes (el motor recorta cada diseño a su cuadro):
arriba a la izquierda el frente, arriba a la derecha la espalda; los de abajo, las mangas.

- Taza: la mitad de adelante de la pared (de costado a costado) va al cuadro del frente y la de atrás
  al de la espalda, a la misma escala (cm del patrón iguales en todos lados, sin estirar). Adentro,
  fondo, borde y asa van a un rincón sin estampar.
- Plancha: el frente va al cuadro del frente con su proporción 20 x 30; espalda y canto, al rincón.

Uso:  python web/scripts/build-hard-models.py
"""
import json
import math
import os
import struct

import numpy as np

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')
# Rincón del patrón donde no se estampa (adentro de la taza, asa, espalda de la plancha).
SPARE_UV = (0.985, 0.985)


class Mesh:
    def __init__(self):
        self.p, self.n, self.uv, self.i = [], [], [], []

    def vert(self, p, n, uv):
        self.p.append(p); self.n.append(n); self.uv.append(uv)
        return len(self.p) - 1

    def tri(self, a, b, c):
        # El orden sigue a la normal: la cara que mira hacia afuera es la de adelante.
        pa, pb, pc = (np.array(self.p[k]) for k in (a, b, c))
        face = np.cross(pb - pa, pc - pa)
        if np.dot(face, np.add(np.add(self.n[a], self.n[b]), self.n[c])) < 0:
            b, c = c, b
        self.i += [a, b, c]


def normalize(v):
    v = np.asarray(v, dtype=float)
    l = np.linalg.norm(v)
    return v / l if l > 1e-12 else v


# ---------------------------------------------------------------- taza
def lathe(m, profile, segs, uv_of, a0=-math.pi, a1=math.pi):
    """
    Gira un perfil [(r, y, nr, ny)] alrededor del eje Y, del ángulo a0 al a1. Ángulo 0 = frente (+z),
    crece hacia +x (a la derecha de quien mira el frente).
    """
    rows = []
    for k in range(segs + 1):
        a = a0 + (a1 - a0) * k / segs
        s, c = math.sin(a), math.cos(a)
        row = []
        for j, (r, y, nr, ny) in enumerate(profile):
            row.append(m.vert((r * s, y, r * c), tuple(normalize((nr * s, ny, nr * c))), uv_of(a, j, r, y)))
        rows.append(row)
    for k in range(segs):
        for j in range(len(profile) - 1):
            a, b, c, d = rows[k][j], rows[k + 1][j], rows[k + 1][j + 1], rows[k][j + 1]
            m.tri(a, c, b); m.tri(a, d, c)


def mug():
    m = Mesh()
    R, H, T = 4.1, 9.6, 0.32     # radio, alto, grosor de la pared (cm)
    segs = 160

    # Pared de afuera: se estampa. Perfil de abajo hacia arriba, con un leve chaflán en la base.
    outer = []
    for y in np.linspace(0.45, H - 0.12, 40):
        outer.append((R, float(y), 1.0, 0.0))
    # Escala del patrón: media vuelta (pi * R) cabe en el ancho de un cuadro con margen.
    k = 0.46 / (math.pi * R)
    ymid = (0.45 + H - 0.12) / 2
    front_uv = lambda a, j, r, y: (0.25 + R * a * k, 0.25 + (ymid - y) * k)
    back_uv = lambda a, j, r, y: (0.75 + R * (a - math.pi) * k, 0.25 + (ymid - y) * k)
    lathe(m, outer, segs // 2, front_uv, -math.pi / 2, math.pi / 2)
    lathe(m, outer, segs // 2, back_uv, math.pi / 2, 3 * math.pi / 2)
    # Chaflán de la base y borde redondeado: sin estampar.
    base = []
    for t in np.linspace(0, 1, 6):
        a = -math.pi / 2 + t * math.pi / 2
        base.append((R - 0.45 + 0.45 * math.cos(a), 0.45 + 0.45 * math.sin(a), math.cos(a), math.sin(a)))
    base.insert(0, (0.0, 0.0, 0.0, -1.0))
    base.insert(1, (R - 0.45, 0.0, 0.0, -1.0))
    lathe(m, base, segs, lambda u, j, r, y: SPARE_UV)
    rim = []
    for t in np.linspace(0, 1, 10):
        a = t * math.pi
        rim.append((R - T / 2 + T / 2 * math.cos(a), H - 0.12 + 0.12 * math.sin(a) * 1.0, math.cos(a), math.sin(a)))
    lathe(m, rim, segs, lambda u, j, r, y: SPARE_UV)
    # Adentro: pared y fondo (normales hacia el centro).
    inner = [(R - T, H - 0.12, -1.0, 0.0), (R - T, 1.05, -1.0, 0.0)]
    fr = 0.4   # curva entre la pared de adentro y el fondo
    for t in np.linspace(0, 1, 7)[1:]:
        a = t * math.pi / 2
        inner.append((R - T - fr + fr * math.cos(a), 1.05 - fr * math.sin(a), -math.cos(a), math.sin(a)))
    inner.append((0.0, 1.05 - fr, 0.0, 1.0))
    lathe(m, inner, segs, lambda u, j, r, y: SPARE_UV)

    # Asa ("oreja") de taza de sublimar: sale cerca del borde, va hacia afuera, baja casi recta y vuelve
    # a entrar abajo (forma de "D", más ancha arriba). Nace y termina dentro de la pared, pegada al cuerpo.
    # Sección plana: más ancha hacia la cámara que gruesa, como el asa de cerámica real.
    path = [(R - 0.3, 8.05), (R + 0.6, 8.2), (R + 1.85, 7.95), (R + 2.65, 7.05), (R + 2.9, 5.7),
            (R + 2.7, 4.3), (R + 2.05, 3.1), (R + 1.0, 2.4), (R - 0.3, 2.25)]

    def spline(t):
        """Catmull-Rom por los puntos del camino (t de 0 a 1)."""
        n = len(path) - 1
        f = min(t * n, n - 1e-9)
        i = int(f)
        u = f - i
        p0 = np.array(path[max(i - 1, 0)]); p1 = np.array(path[i])
        p2 = np.array(path[i + 1]); p3 = np.array(path[min(i + 2, n)])
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)

    ring = 32
    steps = 90
    rows = []
    for s in range(steps + 1):
        t = s / steps
        c2 = spline(t)
        d2 = spline(min(t + 1e-3, 1)) - spline(max(t - 1e-3, 0))
        center = np.array([c2[0], c2[1], 0.0])
        tangent = normalize((d2[0], d2[1], 0.0))
        nrm = normalize(np.cross(tangent, (0, 0, 1)))
        bin_ = np.array([0.0, 0.0, 1.0])
        rw = 0.64 - 0.08 * t   # medio ancho hacia la cámara (un poco más angosta abajo)
        rh = 0.36              # medio grosor
        row = []
        for q in range(ring + 1):
            ph = 2 * math.pi * q / ring
            off = nrm * math.cos(ph) * rh + bin_ * math.sin(ph) * rw
            nn = normalize(nrm * math.cos(ph) / rh + bin_ * math.sin(ph) / rw)
            row.append(m.vert(tuple(center + off), tuple(nn), SPARE_UV))
        rows.append(row)
    for s in range(steps):
        for q in range(ring):
            a, b, c, d = rows[s][q], rows[s + 1][q], rows[s + 1][q + 1], rows[s][q + 1]
            m.tri(a, b, c); m.tri(a, c, d)
    return m


# ---------------------------------------------------------------- plancha
def plate():
    m = Mesh()
    W, H, T, rc = 20.0, 30.0, 0.12, 0.9   # ancho, alto, grosor, radio de las esquinas (cm)
    # Contorno de rectángulo redondeado (sentido antihorario visto de frente).
    pts = []
    for cx, cy, a0 in ((W / 2 - rc, -H / 2 + rc, -math.pi / 2), (W / 2 - rc, H / 2 - rc, 0.0),
                       (-W / 2 + rc, H / 2 - rc, math.pi / 2), (-W / 2 + rc, -H / 2 + rc, math.pi)):
        for t in np.linspace(0, math.pi / 2, 10):
            pts.append((cx + rc * math.cos(a0 + t), cy + rc * math.sin(a0 + t)))
    k = 0.46 / H   # el alto cabe en un cuadro del patrón con margen
    uv = lambda x, y: (0.25 + x * k, 0.25 - y * k)
    # Frente (z+): se estampa entero. Abanico desde el centro (el contorno es convexo).
    c = m.vert((0, 0, T / 2), (0, 0, 1), uv(0, 0))
    ring = [m.vert((x, y, T / 2), (0, 0, 1), uv(x, y)) for x, y in pts]
    for k in range(len(ring)):
        m.tri(c, ring[k], ring[(k + 1) % len(ring)])
    # Espalda (z-): sin estampar.
    c = m.vert((0, 0, -T / 2), (0, 0, -1), SPARE_UV)
    ring = [m.vert((x, y, -T / 2), (0, 0, -1), SPARE_UV) for x, y in pts]
    for k in range(len(ring)):
        m.tri(c, ring[(k + 1) % len(ring)], ring[k])
    # Canto.
    n = len(pts)
    for k in range(n):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % n]
        nn = normalize((y1 - y0, -(x1 - x0), 0))
        a = m.vert((x0, y0, T / 2), tuple(nn), SPARE_UV)
        b = m.vert((x1, y1, T / 2), tuple(nn), SPARE_UV)
        cc = m.vert((x1, y1, -T / 2), tuple(nn), SPARE_UV)
        d = m.vert((x0, y0, -T / 2), tuple(nn), SPARE_UV)
        m.tri(a, cc, b); m.tri(a, d, cc)
    return m


# ---------------------------------------------------------------- .glb
def write_glb(m, path, material):
    P = np.array(m.p, dtype=np.float32)
    N = np.array(m.n, dtype=np.float32)
    U = np.array(m.uv, dtype=np.float32)
    I = np.array(m.i, dtype=np.uint32)
    blobs = [P.tobytes(), N.tobytes(), U.tobytes(), I.tobytes()]
    views, off = [], 0
    data = b''
    for k, b in enumerate(blobs):
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), 'target': 34963 if k == 3 else 34962})
        data += b
        off += len(b)
        pad = (-len(data)) % 4
        data += b'\0' * pad
        off += pad
    gltf = {
        'asset': {'version': '2.0', 'generator': 'vexa build-hard-models.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': material}],
        'materials': [{'name': material, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.3}}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
        'buffers': [{'byteLength': len(data)}],
        'bufferViews': views,
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()},
            {'bufferView': 1, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': len(U), 'type': 'VEC2'},
            {'bufferView': 3, 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'},
        ],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(data)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(data), 0x004E4942)); f.write(data)
    print(path, len(P), 'vértices', len(I) // 3, 'triángulos', round(total / 1024), 'KB')


if __name__ == '__main__':
    write_glb(mug(), os.path.join(OUT, 'taza.glb'), 'imprimible')
    write_glb(plate(), os.path.join(OUT, 'plancha-metal.glb'), 'imprimible')
