// Shader WebGL del hero (copiado tal cual de la pantalla de Stitch).
export const VERTEX = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const FRAGMENT = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

// Simplex / smooth organic noise helpers
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution;
    
    // Aspect ratio correction
    st.x *= u_resolution.x / u_resolution.y;
    mouse.x *= u_resolution.x / u_resolution.y;
    
    float t = u_time * 0.18;
    
    // Interactive mouse displacement
    vec2 mDelta = st - mouse;
    float mDist = length(mDelta);
    float mouseWave = sin(mDist * 16.0 - u_time * 2.5) * exp(-mDist * 3.5);
    
    // Multi-octave organic flowing liquid / aurora
    vec2 q = vec2(0.0);
    q.x = snoise(st * 1.8 + vec2(t * 0.7, t * 0.4));
    q.y = snoise(st * 1.8 + vec2(-t * 0.5, t * 0.8));
    
    vec2 r = vec2(0.0);
    r.x = snoise(st * 2.4 + 1.2 * q + vec2(1.7, 9.2) + 0.15 * t + mouseWave * 0.25);
    r.y = snoise(st * 2.4 + 1.2 * q + vec2(8.3, 2.8) + 0.126 * t);
    
    float f = snoise(st * 1.5 + r + mouseWave * 0.15);
    f = 0.5 + 0.5 * f;
    
    // Andean Luxe / Paseo 360 Palette:
    // Deep Petrol Navy: #002B49 -> vec3(0.0, 0.168, 0.286)
    // Cyan Light Accent: #00A3FF -> vec3(0.0, 0.639, 1.0)
    // Crisp Pale Ice Surface: #F4F8FC -> vec3(0.957, 0.972, 0.988)
    // Rich Blue: #0A3D62 -> vec3(0.039, 0.239, 0.384)
    vec3 cDeep = vec3(0.0, 0.168, 0.286);
    vec3 cMid = vec3(0.04, 0.31, 0.49);
    vec3 cCyan = vec3(0.0, 0.72, 0.96);
    vec3 cBright = vec3(0.95, 0.97, 0.99);
    
    vec3 col = mix(cBright, cMid, smoothstep(0.1, 0.75, f));
    col = mix(col, cCyan, smoothstep(0.4, 0.95, length(q)));
    col = mix(col, cDeep, smoothstep(0.5, 0.9, r.x));
    
    // Subtle luminosity highlight around mouse
    col += cCyan * (1.0 - smoothstep(0.0, 0.35, mDist)) * 0.35;
    
    // Keep hero transparent and gentle for text contrast
    gl_FragColor = vec4(col, 0.42);
}`;

/** Dibuja el fondo animado en el canvas; devuelve la función para detenerlo. */
export function iniciarShader(canvas: HTMLCanvasElement): () => void {
  function syncSize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
  observer?.observe(canvas);
  syncSize();

  const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
  if (!gl) return () => observer?.disconnect();

  function compilar(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uRes = gl.getUniformLocation(prog, "u_resolution");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");

  const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  const onMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      mouse.y = (1.0 - (event.clientY - rect.top) / rect.height) * canvas.height;
    }
  };
  window.addEventListener("mousemove", onMove);

  let raf = 0;
  function render(t: number) {
    gl!.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl!.uniform1f(uTime, t * 0.001);
    if (uRes) gl!.uniform2f(uRes, canvas.width, canvas.height);
    if (uMouse) gl!.uniform2f(uMouse, mouse.x, mouse.y);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(render);
  }
  render(0);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("mousemove", onMove);
    observer?.disconnect();
  };
}
