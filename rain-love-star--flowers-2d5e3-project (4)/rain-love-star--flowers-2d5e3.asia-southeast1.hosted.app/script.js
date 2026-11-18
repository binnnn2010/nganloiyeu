// ==================================================================
// MÀN MỞ ĐẦU — "Đóa hồng hé nở" (plan-07 §0)
// Nụ hồng neon thở nhẹ trên nền đen. Chạm → nhạc vào, hồng nở bừng, cánh hoa
// tung lên rồi rơi xuống, cơn mưa lời yêu đổ ào từ trên theo. Cú chạm này cũng
// là user gesture hợp lệ để phát nhạc có tiếng ngay từ giây đầu.
// ==================================================================

const INTRO = {
    bloom: 1900,       // ms: hồng nở hết (vòng ngoài nở trước, vòng trong sau)
    burst: 1250,       // cánh hoa tung lên
    roseOut: 1950,     // hồng mờ dần, mưa bắt đầu đổ
    bgOut: 2200,       // nền đen của màn mở đầu tan, lộ cơn mưa
    unlock: 3700,      // cho phép giữ tay gom yêu thương
    hint: 4700,        // hiện gợi ý "chạm & giữ"
    done: 5500,        // gỡ hẳn màn mở đầu
    petals: 30
};

// ---- BÔNG HỒNG 3D ----
// Mỗi cánh là một mặt cong: khum ngang vào tâm, mép trên cuộn ra ngoài, dán ảnh
// chụp cánh hồng thật và nhận ánh sáng — chính phần đổ bóng trên mặt cong làm
// hoa trông như thật. 5 vòng cánh xoắn ốc; độ ngả của từng vòng nội suy giữa
// "nụ" và "nở" theo một tham số open (0 → 1).
const ROSE_RINGS = [
    // n cánh, rộng, cao, bán kính gốc, độ ngả lúc nụ / lúc nở (rad), khum, cuộn
    { n: 3, w: 0.95, h: 1.05, r: 0.04, bud: 0.02, open: 0.20, cup: 0.42, curl: 0.10 },
    { n: 4, w: 1.15, h: 1.22, r: 0.10, bud: 0.05, open: 0.38, cup: 0.40, curl: 0.18 },
    { n: 5, w: 1.38, h: 1.40, r: 0.17, bud: 0.09, open: 0.58, cup: 0.36, curl: 0.28 },
    { n: 6, w: 1.62, h: 1.55, r: 0.25, bud: 0.15, open: 0.78, cup: 0.32, curl: 0.38 },
    { n: 7, w: 1.85, h: 1.66, r: 0.33, bud: 0.24, open: 0.98, cup: 0.28, curl: 0.46 }
];

let introRose = null;

// ---- CÁNH HOA TÔNG VINTAGE ----
// Ảnh gốc là cánh hồng đỏ. Đổi màu ngay trong trình duyệt: lấy độ sáng từng
// điểm ảnh (giữ nguyên vân cánh và chỗ sáng tối) rồi tô lại theo dải màu hồng
// phấn – blush – kem, giống tông mận–đào của màn 2.
const INTRO_PETAL_RAMP = [
    [0.0, [192, 132, 136]],    // hồng mận nhạt ở chỗ tối
    [0.5, [236, 186, 180]],    // blush
    [0.8, [242, 214, 200]],    // hồng kem
    [1.0, [253, 243, 232]]     // kem sáng ở gốc cánh
];
const introPetalCanvases = {};
const introPetalUrls = {};

function rampColor(t) {
    for (let i = 1; i < INTRO_PETAL_RAMP.length; i++) {
        const [t1, c1] = INTRO_PETAL_RAMP[i];
        const [t0, c0] = INTRO_PETAL_RAMP[i - 1];
        if (t <= t1) {
            const f = (t - t0) / (t1 - t0);
            return [0, 1, 2].map(j => c0[j] + (c1[j] - c0[j]) * f);
        }
    }
    return INTRO_PETAL_RAMP[INTRO_PETAL_RAMP.length - 1][1];
}

function introPetalCanvas(name) {
    if (!introPetalCanvases[name]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        introPetalCanvases[name] = canvas;
    }
    return introPetalCanvases[name];
}

function introPetalUrl(name) {
    return introPetalUrls[name] || `./assets/intro/${name}.svg`;
}

const introPetalReady = Promise.all(['petal', 'petal-b'].map(name => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
        const canvas = introPetalCanvas(name);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            if (!px[i + 3]) continue;
            // Cánh đỏ: kênh đỏ mang vân, kênh xanh lá sáng lên ở chỗ trắng gần gốc.
            const r = px[i] / 255;
            const g = px[i + 1] / 255;
            const t = Math.min(1, Math.max(0, (r - 0.42) / 0.58 * 0.75 + g * 0.6));
            const [cr, cg, cb] = rampColor(t);
            px[i] = cr; px[i + 1] = cg; px[i + 2] = cb;
        }
        ctx.putImageData(data, 0, 0);
        try { introPetalUrls[name] = canvas.toDataURL('image/png'); } catch (e) { /* file:// */ }
        resolve();
    };
    img.onerror = resolve;
    img.src = `./assets/intro/${name}.svg`;
})));

function makePetalGeometry(w, h, cup, curl) {
    const geo = new THREE.PlaneGeometry(w, h, 12, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i) + h / 2;          // gốc cánh ở y = 0
        const u = x / (w / 2);                  // -1 … 1 theo bề ngang
        const v = y / h;                        // 0 … 1 từ gốc lên mép
        // Khum: hai mép ôm vào tâm hoa (−z), khum mạnh dần lên phía trên.
        let z = -cup * u * u * (0.35 + 0.65 * v);
        // Mép trên cuộn ngược ra ngoài (+z), và hơi gợn.
        const t = Math.max(0, v - 0.55) / 0.45;
        z += curl * t * t * (1 + 0.25 * Math.sin(u * 3.1));
        // Gốc cánh thót lại cho liền vào đài hoa.
        pos.setXYZ(i, x * (0.55 + 0.45 * Math.sqrt(v)), y, z);
    }
    geo.computeVertexNormals();
    return geo;
}

// Lá hồng: hình bầu dục nhọn đầu, gập nhẹ theo gân giữa, chóp hơi cong xuống.
function makeLeafGeometry(w, h) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(w * 0.55, h * 0.18, w * 0.6, h * 0.62, 0, h);
    shape.bezierCurveTo(-w * 0.6, h * 0.62, -w * 0.55, h * 0.18, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const v = y / h;
        pos.setZ(i, Math.abs(x) * 0.45 - 0.18 * v * v);
    }
    geo.computeVertexNormals();
    return geo;
}

function createIntroRose(canvas) {
    if (typeof THREE === 'undefined' || !canvas) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
        return null;
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    // Khung dọc: hoa ở phần trên, thân dài chạy xuống gần đáy khung.
    camera.position.set(0, 3.4, 13);
    camera.lookAt(0, -1.9, 0);

    // Đèn chính ấm từ trên-trái, đèn viền hồng phía sau để mép cánh sáng lên.
    scene.add(new THREE.HemisphereLight(0xfff2e6, 0x8a6070, 0.85));
    const key = new THREE.DirectionalLight(0xfff1e2, 1.2);
    key.position.set(-3, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd2b8, 0.7);
    rim.position.set(2.5, 2, -5);
    scene.add(rim);

    const texA = new THREE.CanvasTexture(introPetalCanvas('petal'));
    const texB = new THREE.CanvasTexture(introPetalCanvas('petal-b'));
    [texA, texB].forEach(tex => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; });
    // Ảnh cánh nạp xong (và đã đổi sang tông vintage) thì báo texture cập nhật.
    introPetalReady.then(() => { texA.needsUpdate = true; texB.needsUpdate = true; });

    const flower = new THREE.Group();
    flower.position.y = 0.2;
    scene.add(flower);

    const petals = [];
    ROSE_RINGS.forEach((ring, k) => {
        const geo = makePetalGeometry(ring.w, ring.h, ring.cup, ring.curl);
        const mat = new THREE.MeshStandardMaterial({
            map: k < 2 ? texB : texA,
            color: new THREE.Color().setHSL(0.02, 0.3, 0.9 + 0.025 * k),
            roughness: 0.62,
            metalness: 0,
            side: THREE.DoubleSide,
            alphaTest: 0.45
        });
        for (let i = 0; i < ring.n; i++) {
            const angle = (Math.PI * 2 * i) / ring.n + k * 0.62 + (i % 2 ? 0.08 : -0.05);
            const pivot = new THREE.Object3D();
            pivot.rotation.y = angle;
            const holder = new THREE.Object3D();
            holder.position.z = ring.r;
            holder.position.y = -0.05 * k;
            const mesh = new THREE.Mesh(geo, mat);
            // Mỗi cánh xoay lệch một chút quanh trục dọc cho bớt đều như máy.
            mesh.rotation.y = (i % 2 ? 1 : -1) * 0.12;
            holder.add(mesh);
            pivot.add(holder);
            flower.add(pivot);
            petals.push({ holder, ring, k, jitter: (Math.sin(i * 12.9 + k * 7.1) * 0.5) * 0.08 });
        }
    });

    // Đài hoa xanh dưới cùng + cuống.
    const green = new THREE.MeshStandardMaterial({ color: 0x5d7356, roughness: 0.85, side: THREE.DoubleSide });
    const sepalGeo = makePetalGeometry(0.28, 0.75, 0.08, 0.2);
    for (let i = 0; i < 5; i++) {
        const pivot = new THREE.Object3D();
        pivot.rotation.y = (Math.PI * 2 * i) / 5 + 0.3;
        const holder = new THREE.Object3D();
        holder.position.set(0, -0.14, 0.12);
        holder.rotation.x = 2.2;
        holder.add(new THREE.Mesh(sepalGeo, green));
        pivot.add(holder);
        flower.add(pivot);
    }
    // Thân dài, cong chữ S rất nhẹ, có hai lá và vài gai.
    const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.1, 0),
        new THREE.Vector3(0.06, -1.5, 0.04),
        new THREE.Vector3(-0.1, -3.2, 0.08),
        new THREE.Vector3(0.04, -5.0, 0.02),
        new THREE.Vector3(-0.02, -6.6, 0)
    ]);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x55694d, roughness: 0.8 });
    flower.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 64, 0.075, 10, false), stemMat));

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f8766, roughness: 0.65, side: THREE.DoubleSide });
    const leafGeo = makeLeafGeometry(0.62, 1.25);
    [
        { t: 0.36, side: 1, yaw: 0.5, scale: 1 },
        { t: 0.6, side: -1, yaw: -2.4, scale: 0.85 }
    ].forEach(leaf => {
        const at = stemCurve.getPointAt(leaf.t);
        const holder = new THREE.Object3D();
        holder.position.copy(at);
        holder.rotation.y = leaf.yaw;
        const mesh = new THREE.Mesh(leafGeo, leafMat);
        // Lá chĩa chéo lên, ngả ra ngoài thân.
        mesh.rotation.z = -leaf.side * 0.95;
        mesh.rotation.x = 0.35;
        mesh.scale.setScalar(leaf.scale);
        holder.add(mesh);
        flower.add(holder);
    });

    const thornGeo = new THREE.ConeGeometry(0.035, 0.16, 6);
    [0.2, 0.47, 0.72, 0.85].forEach((t, i) => {
        const thorn = new THREE.Mesh(thornGeo, stemMat);
        thorn.position.copy(stemCurve.getPointAt(t));
        thorn.rotation.set(0.4, i * 2.1, (i % 2 ? 1 : -1) * 1.9);
        flower.add(thorn);
    });

    const state = {
        renderer, scene, camera, flower, petals,
        open: 0, openFrom: 0, openStart: 0, opening: false,
        start: performance.now(), raf: 0, stopped: false,
        w: canvas.clientWidth, h: canvas.clientHeight
    };

    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
        if (state.stopped) return;
        const t = (now - state.start) / 1000;
        let base;
        if (state.opening) {
            base = Math.min(1, (now - state.openStart) / INTRO.bloom);
        } else {
            // Nụ "thở": hé ra rất khẽ rồi khép lại.
            base = 0.06 + 0.04 * Math.sin(t * 1.9);
        }
        state.petals.forEach(p => {
            // Vòng ngoài nở trước, vòng trong theo sau.
            const lag = (4 - p.k) * 0.09;
            const o = state.opening
                ? state.openFrom + (1 - state.openFrom) * ease(Math.max(0, Math.min(1, (base - lag) / 0.64)))
                : base;
            p.holder.rotation.x = p.ring.bud + (p.ring.open - p.ring.bud) * o + p.jitter;
        });
        // Khung canvas đổi cỡ (xoay máy, media query) thì vẽ lại theo cỡ mới.
        if (canvas.clientWidth !== state.w || canvas.clientHeight !== state.h) {
            state.w = canvas.clientWidth;
            state.h = canvas.clientHeight;
            renderer.setSize(state.w, state.h, false);
            camera.aspect = state.w / state.h;
            camera.updateProjectionMatrix();
        }
        flower.rotation.y = t * 0.22;
        flower.rotation.z = Math.sin(t * 0.8) * 0.03;
        renderer.render(scene, camera);
        state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
    requestAnimationFrame(() => canvas.classList.add('is-shown'));
    return state;
}

function buildIntroDust() {
    const layer = document.getElementById('intro-dust');
    if (!layer || introReducedMotion()) return;
    let html = '';
    for (let i = 0; i < 26; i++) {
        // Dồn quanh vùng giữa, nơi hoa đứng dưới luồng đèn.
        const x = 50 + (Math.random() - 0.5) * 70;
        const y = 15 + Math.random() * 70;
        html += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;` +
            `--d:${(7 + Math.random() * 6).toFixed(1)}s;--delay:${(-Math.random() * 10).toFixed(1)}s;` +
            `--dx:${Math.round((Math.random() - 0.5) * 40)}px;--o:${(0.35 + Math.random() * 0.5).toFixed(2)};` +
            `transform:scale(${(0.5 + Math.random() * 0.8).toFixed(2)})"></i>`;
    }
    layer.innerHTML = html;
}

function bloomIntroRose() {
    if (!introRose) return;
    introRose.openFrom = 0.08;
    introRose.openStart = performance.now();
    introRose.opening = true;
}

function disposeIntroRose() {
    if (!introRose) return;
    introRose.stopped = true;
    cancelAnimationFrame(introRose.raf);
    introRose.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    });
    introRose.renderer.dispose();
    introRose = null;
}

let introStarted = false;

function introReducedMotion() {
    return typeof prefersReducedMotion === 'function' && prefersReducedMotion();
}

function setupIntro() {
    const intro = document.getElementById('intro');
    if (!intro) return;

    introRose = createIntroRose(document.getElementById('intro-rose-canvas'));
    buildIntroDust();

    const button = document.getElementById('intro-btn');
    const markReady = () => {
        intro.classList.add('is-ready');
        if (button) {
            button.disabled = false;
            button.textContent = 'Chạm để mở quà ♡';
        }
    };
    if (window.rainReady) markReady();
    else document.addEventListener('rain:ready', markReady, { once: true });

    // Chạm bất kỳ đâu trên màn mở đầu cũng mở quà, không bắt nhắm đúng nút.
    intro.addEventListener('click', () => {
        if (window.rainReady) openIntro(intro);
    });
}

function openIntro(intro) {
    if (introStarted) return;
    introStarted = true;

    if (typeof playBackgroundMusic === 'function') {
        musicAutoplayAttempted = true;
        playBackgroundMusic().catch(() => { musicAutoplayAttempted = false; });
    }

    const at = (ms, fn) => setTimeout(fn, ms);

    if (introReducedMotion()) {
        intro.classList.add('is-opening', 'is-leaving');
        at(600, () => finishIntro(intro));
        return;
    }

    intro.classList.add('is-opening');
    bloomIntroRose();
    at(INTRO.burst, () => burstIntroPetals(intro));
    at(INTRO.roseOut, () => {
        intro.classList.add('is-rose-out');
        if (typeof rainPourIn === 'function') rainPourIn();
    });
    at(INTRO.bgOut, () => intro.classList.add('is-leaving'));
    at(INTRO.unlock, () => document.body.classList.remove('intro-open'));
    at(INTRO.hint, () => { if (typeof setHintVisible === 'function') setHintVisible(true); });
    at(INTRO.done, () => { disposeIntroRose(); intro.remove(); });
}

function finishIntro(intro) {
    document.body.classList.remove('intro-open');
    if (typeof setHintVisible === 'function') setHintVisible(true);
    disposeIntroRose();
    intro.remove();
}

// Cánh hoa bung ra từ tâm đóa hồng: vọt lên (chậm dần) rồi rơi (nhanh dần),
// vừa rơi vừa lắc và lật. Web Animations cho phép mỗi chặng một easing riêng.
function burstIntroPetals(intro) {
    const layer = intro.querySelector('.intro-petals');
    const rose = intro.querySelector('.intro-rose-canvas');
    if (!layer || !rose) return;

    const r = rose.getBoundingClientRect();
    const x0 = r.left + r.width / 2;
    const y0 = r.top + r.height * 0.24;
    const H = window.innerHeight;
    const W = window.innerWidth;

    for (let i = 0; i < INTRO.petals; i++) {
        const el = document.createElement('span');
        // Cùng ảnh cánh hồng thật với bông hoa, sáng tối khác nhau cho có chiều sâu.
        const size = 16 + Math.random() * 18;
        el.className = 'intro-petal';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundImage = `url(${introPetalUrl(i % 3 ? 'petal' : 'petal-b')})`;
        el.style.filter = `brightness(${(0.8 + Math.random() * 0.35).toFixed(2)})`;
        layer.appendChild(el);

        // Tỏa ra hình quạt hướng lên, rộng theo bề ngang màn hình.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const reach = 90 + Math.random() * Math.min(W, H) * 0.35;
        const peakX = x0 + Math.cos(angle) * reach;
        const peakY = y0 + Math.sin(angle) * reach;
        const endX = peakX + (Math.random() - 0.3) * W * 0.25;
        const sway = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 30);
        const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
        const dur = 2600 + Math.random() * 1400;
        const p = (x, y, rot, tilt, s) =>
            `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) rotate(${rot}deg) rotateX(${tilt}deg) scale(${s})`;

        el.animate([
            { transform: p(x0, y0, 0, 0, 0.3), opacity: 0, easing: 'cubic-bezier(0.15, 0.8, 0.3, 1)' },
            { transform: p(peakX, peakY, spin * 0.25, 40, 1), opacity: 1, offset: 0.24, easing: 'cubic-bezier(0.45, 0, 0.75, 0.6)' },
            { transform: p((peakX + endX) / 2 + sway, (peakY + H) / 2, spin * 0.6, -30, 1), opacity: 1, offset: 0.62, easing: 'cubic-bezier(0.4, 0, 0.8, 0.8)' },
            { transform: p(endX - sway, H + 40, spin, 50, 0.9), opacity: 0.85 }
        ], { duration: dur, delay: Math.random() * 180, fill: 'both' });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupIntro, { once: true });
} else {
    setupIntro();
}

// ---- MÀN 1: MƯA LỜI YÊU · GIỮ TAY ĐỂ GOM ----
// Lời yêu 3D rơi như mưa, tim đỏ rơi xen kẽ, hạt sáng lấp lánh (thông số lấy
// từ rain-3d-new, viết lại bằng Three r128 cho chung một WebGL context với
// cú chuyển cảnh). Người xem đặt ngón tay lên màn hình: mưa bị hút về chỗ
// ngón tay, xoáy như lốc rồi siết dần thành một trái tim. Giữ đủ HOLD_MS rồi
// thả tay → trái tim co về đúng chỗ tim ngân hà ở màn 2 và nở ra ở đó.
//
// File này nạp SAU script.js (dùng letter, getUrlParameter, nhạc, helper...)
// và TRƯỚC orbit.js. Hàm của orbit.js chỉ được gọi khi người xem đã thả tay,
// lúc đó orbit.js chắc chắn đã nạp xong.

// 15 câu mặc định của rain-3d-new. Có ?rain= hoặc lời nhắn LoveGift thì thay.
const DEFAULT_RAIN_MESSAGES = [
    'Yêu em ❤️',
    'Em là cả thế giới của anh 🌍💕',
    'Anh yêu em nhiều lắm 💖',
    'Mãi mãi bên em 💍✨',
    'Em là tất cả của anh 🥰',
    'Có em là có hạnh phúc 🌸💞',
    'Cảm ơn em đã đến bên anh 🌹',
    'Em là định mệnh của anh 💫',
    'Anh thương em 💗',
    'Suốt đời này chỉ yêu mình em 💋',
    'Em xinh nhất quả đất 🌎💐',
    'Trái tim anh thuộc về em 💘',
    'Bên em là bình yên 🌷☁️',
    'Yêu em nhiều hơn hôm qua 💝',
    'Em là điều tuyệt vời nhất 🎀💕'
];

const RAIN_MAX_CHARS = 60;

function buildRainMessages() {
    const fromUrl = getUrlParameter('rain');
    const list = Array.isArray(fromUrl)
        ? fromUrl
        : (typeof fromUrl === 'string' ? fromUrl.split(',') : null);
    const pick = arr => (arr || [])
        .map(text => String(text || '').trim().slice(0, RAIN_MAX_CHARS))
        .filter(Boolean);

    const custom = pick(list);
    if (custom.length) return custom;
    const fromLovegift = pick(lovegiftConfig.messages);
    if (fromLovegift.length) return fromLovegift;
    return DEFAULT_RAIN_MESSAGES;
}

const rainMessages = buildRainMessages();

// Máy yếu: giảm độ phân giải vẽ. Cùng tiêu chí với orbitDeviceTier() ở orbit.js.
const RAIN_LITE = (() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory;
    return cores <= 4 || (typeof memory === 'number' && memory <= 4);
})();

// Mọi con số dưới đây chép từ rain-3d-new (home.js: Zr, Hr, Nr, Fr, kr và
// particle-effect.js: w0) để màn mưa trông y như bản gốc.
const RAIN = {
    fov: 100,
    camX: -10,
    camZ: 30,
    // Lưới chữ 8 lớp sâu × 15 cột. Câu dài (> 20 ký tự) giãn cách 6, ngắn 3.
    textRows: 8,
    textCols: 15,
    fontSize: 1.5,
    letterSpacing: -0.1,
    wrapWords: 8,
    textFloor: -30,
    textSpeed: [14, 20],
    // Lưới tim 10 × 10, rơi từ y 50–70 xuống -40.
    heartRows: 10,
    heartCols: 10,
    heartScale: 0.15,
    heartTop: [50, 70],
    heartFloor: -40,
    heartSpeed: [5, 15],
    heartColor: 0xff1e00,
    sparkles: 1000,
    pink: new THREE.Color('#EE66A6').convertSRGBToLinear(),
    blue: new THREE.Color('#99DDFF').convertSRGBToLinear(),
    colorPeriod: 2.5,
    // Bản gốc: emissiveIntensity 1.5 cộng ánh sáng môi trường, toneMapped tắt.
    textGlow: 1.15,
    bloom: { strength: 0.9, radius: 0.7, threshold: 0.1 }
};

// Giữ tay bao lâu thì tim hình thành.
const HOLD_MS = 1800;
// "Bay xuyên mưa" sau khi thả tay (ms / đơn vị thế giới). Xem plan-07 §2.3.
const RAIN_EXIT = {
    pulse: 500,          // tim ngân hà đập một nhịp trước khi bay
    steer: 1300,         // camera lái vào tâm tim
    duration: 3600,      // tổng quãng lao tới — xuyên qua tim ở ~1,4 s
    distance: 200,       // camera.z = 30 − distance·p²
    fovKick: 18,         // FOV 100 → 118
    tunnelFrom: 900,     // từ đây vật lọt ra sau camera được đặt lại phía trước
    glowStart: 1700,
    glowFull: 3300,
    orbitOpen: 2700,
    veilStart: 2700,
    veilDur: 600,
    handoff: 3200,
    bloomPeak: 2.4
};

let rainItems = [];
let rainSparkles = null;
let rainComposer = null;
let rainBloom = null;
let rainClock = null;
let rainTime = 0;
let rainHeartSize = 6;
let rainGlow = null;
let rainGalaxy = null;

// Trái tim ngân hà lúc giữ tay (plan-07 §2.5): hạt sáng xoắn ốc về thành một
// trái tim 3D dày; vài tim đỏ đậu trên viền; vài câu chữ bay thành vòng quỹ
// đạo quanh tim. Còn lại vẫn là mưa, chỉ chậm dần và mờ bớt.
const GALAXY = {
    count: RAIN_LITE ? 1600 : 2800,
    edgeHearts: 30,
    ringTexts: 12,
    depth: 0.38,       // độ phồng 3D, theo nửa bề ngang tim
    turns: 1,          // số vòng xoắn khi hạt bay vào — phải là số nguyên
    // Vầng chữ bao quanh tim (elip trong mặt phẳng tim), theo nửa bề ngang tim.
    haloX: 1.6,
    haloY: 1.3
};

// Trạng thái cú giữ tay. center = điểm ngón tay trên mặt phẳng z = 0 (toạ độ
// thế giới), centerGoal là nơi ngón tay đang ở — tâm lốc đuổi theo cho mượt.
const hold = {
    active: false,
    pointerId: null,
    start: 0,
    progress: 0,
    formed: false,
    center: new THREE.Vector3(),
    centerGoal: new THREE.Vector3(),
    screen: { x: 0, y: 0 }
};

// Chuyển cảnh sang màn 2 đang chạy (null nếu không).
let rainExit = null;

// ---- HÌNH HỌC ----
// Chiều cao/rộng khung nhìn (đơn vị thế giới) ở độ sâu z — xấp xỉ, đủ để
// ước lượng cỡ trái tim.
function viewHeightAt(z) {
    return 2 * (RAIN.camZ - z) * Math.tan(THREE.MathUtils.degToRad(RAIN.fov / 2));
}

function viewWidthAt(z) {
    return viewHeightAt(z) * (window.innerWidth / window.innerHeight);
}

function randBetween([min, max]) {
    return min + Math.random() * (max - min);
}

// Điểm trên viền tim, gốc ở giữa tim, nửa bề ngang = 1.
// heartCurveNormalized (script.js) trả về hệ 0–100 với y hướng xuống.
function heartPoint(t) {
    const [x, y] = heartCurveNormalized(t);
    return [(x - 50) / 50, ((50 - y) / 50) * (28.8 / 32)];
}

// Đổi toạ độ màn hình (px) sang điểm trên mặt phẳng z = 0.
function screenToWorld(x, y, out) {
    const v = new THREE.Vector3((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0.5);
    v.unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    return out.copy(camera.position).add(dir.multiplyScalar(dist));
}

// ---- CHỮ ----
// Bản gốc dùng troika-three-text (font Mali, cỡ 1.5, giãn chữ -0.1, tự xuống
// dòng sau 8 từ). Ở đây vẽ MỘT lần lên canvas rồi dán lên mặt phẳng, cùng kích
// thước thế giới. Chữ vẽ trắng rồi phủ trắng cả emoji (troika cũng vẽ emoji một
// màu), màu hồng ↔ xanh nhuộm qua material.color.
function wrapRainText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    for (let i = 0; i < words.length; i += RAIN.wrapWords) {
        lines.push(words.slice(i, i + RAIN.wrapWords).join(' '));
    }
    return lines;
}

function makeTextTexture(text) {
    const fontPx = 96;
    const lineH = fontPx * 1.2;
    const pad = Math.ceil(fontPx * 0.2);
    const font = `${fontPx}px 'Mali', sans-serif`;
    const lines = wrapRainText(text);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const setup = () => {
        ctx.font = font;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${RAIN.letterSpacing * fontPx}px`;
    };
    setup();
    const textW = Math.max(...lines.map(line => ctx.measureText(line).width));
    canvas.width = Math.ceil(textW + pad * 2);
    canvas.height = Math.ceil(lines.length * lineH + pad * 2);

    // Đổi kích thước canvas là mất hết trạng thái ctx, phải đặt lại.
    setup();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, pad + lineH * (i + 0.5)));
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const unit = RAIN.fontSize / fontPx;
    return { texture, width: canvas.width * unit, height: canvas.height * unit };
}

// ---- DỰNG CẢNH ----
function initRainScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(RAIN.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(RAIN.camX, 0, RAIN.camZ);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RAIN_LITE ? 1.5 : 2));
    renderer.setClearColor(0x000000, 1);

    const container = document.getElementById('three-container');
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.8s ease';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const magenta = new THREE.PointLight(0xff00ff, 0.5, 20);
    magenta.position.set(10, 10, 0);
    scene.add(magenta);

    // Bloom như bản gốc (ngưỡng 0.1: gần như mọi thứ sáng đều toả quầng).
    if (THREE.EffectComposer && THREE.UnrealBloomPass) {
        rainComposer = new THREE.EffectComposer(renderer);
        rainComposer.addPass(new THREE.RenderPass(scene, camera));
        rainBloom = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            RAIN.bloom.strength, RAIN.bloom.radius, RAIN.bloom.threshold
        );
        rainComposer.addPass(rainBloom);
    }

    // Đốm sáng cuối đường hầm (cú bay sang màn 2). Gắn vào camera nên camera
    // phải nằm trong scene thì con của nó mới được vẽ.
    rainGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0
    }));
    rainGlow.renderOrder = 10;
    rainGlow.visible = false;
    camera.add(rainGlow);
    scene.add(camera);

    rainClock = new THREE.Clock();
}

function makeGlowTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.18, 'rgba(255, 220, 236, 0.95)');
    g.addColorStop(0.45, 'rgba(255, 120, 180, 0.55)');
    g.addColorStop(1, 'rgba(255, 60, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

// Rơi kiểu bản gốc: y = top − (t·speed mod (top − floor)). Lần đầu lấy pha
// ngẫu nhiên để mở trang đã thấy mưa khắp nơi.
function resetRainFall(item) {
    item.rain.y = item.top - Math.random() * (item.top - item.floor);
}

// Màn mở đầu vừa mở quà: đưa cả cơn mưa lên trên mép màn hình để nó đổ ào
// xuống từ trên, nối tiếp những cánh hồng đang rơi — thay vì hiện ra đã đầy sẵn.
function rainPourIn() {
    rainItems.forEach(item => {
        // Mép trên khung nhìn ở đúng độ sâu của vật (vật sau camera: lấy tối thiểu).
        const viewTop = Math.max(4, viewHeightAt(item.home.z) / 2);
        item.rain.y = viewTop + 2 + Math.random() * (item.kind === 'heart' ? 40 : 55);
    });
}

function createRainTexts() {
    const textures = rainMessages.map(makeTextTexture);
    const plane = new THREE.PlaneGeometry(1, 1);
    let a = 0;
    for (let row = 0; row < RAIN.textRows; row++) {
        for (let col = 0; col < RAIN.textCols; col++, a++) {
            const m = a % rainMessages.length;
            const step = rainMessages[m].length > 20 ? 6 : 3;
            const material = new THREE.MeshBasicMaterial({
                map: textures[m].texture,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(plane, material);
            mesh.scale.set(textures[m].width, textures[m].height, 1);
            const item = {
                kind: 'text',
                obj: mesh,
                material,
                base: { x: textures[m].width, y: textures[m].height },
                rain: new THREE.Vector3(-40 + col * step, 0, -10 + row * step * 1.5),
                home: { x: -40 + col * step, z: -10 + row * step * 1.5 },
                top: -10 + Math.random() * 100,
                floor: RAIN.textFloor,
                speed: randBetween(RAIN.textSpeed),
                // Lệch pha màu, như `delay` của bản gốc.
                hue: Math.random() * 2,
                g: 0,
                delay: 0
            };
            resetRainFall(item);
            mesh.position.copy(item.rain);
            scene.add(mesh);
            rainItems.push(item);
        }
    }
}

// ---- ẢNH RƠI ----
// Ảnh người gửi tải lên (LoveGift `image`) rơi lẫn trong mưa chữ, dạng ảnh
// polaroid viền kem. Không có ảnh riêng thì dùng ảnh mặc định của lá thư.
// Ảnh nạp xong tấm nào thì thả tấm đó vào mưa — không bắt màn mưa chờ ảnh.
const RAIN_PHOTO = {
    count: RAIN_LITE ? 10 : 18,
    width: 5.4,             // đơn vị thế giới; cao tự theo khung polaroid
    speed: [7, 11],         // rơi chậm hơn chữ cho kịp nhìn
    tint: 0xf4f0ec,         // ảnh vẽ ngoài bloom (xem animate) nên giữ gần nguyên màu
    layer: 1
};

function rainPhotoUrls() {
    const fromConfig = (typeof lovegiftImages !== 'undefined' ? lovegiftImages : [])
        .map(safePhotoUrl).filter(Boolean);
    const urls = fromConfig.length
        ? fromConfig
        : (typeof letter !== 'undefined' ? letter.map(part => part.photo) : []).filter(Boolean);
    return [...new Set(urls)];
}

// Ảnh → canvas polaroid: cắt vừa khung vuông (object-fit: cover), viền kem,
// lề dưới dày hơn như ảnh lấy liền.
function makePolaroidTexture(img) {
    const W = 256, pad = 12, bottom = 44, inner = W - pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = pad + inner + bottom;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbf4ea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        pad, pad, inner, inner);
    ctx.font = "26px 'Mali', sans-serif";
    ctx.fillStyle = '#d9779f';
    ctx.textAlign = 'center';
    ctx.fillText('♥', W / 2, pad + inner + 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return { texture, aspect: canvas.height / canvas.width };
}

function createRainPhotos() {
    const urls = rainPhotoUrls();
    if (!urls.length) return;
    const plane = new THREE.PlaneGeometry(1, 1);
    let made = 0;

    urls.forEach((url, u) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let tex;
            try { tex = makePolaroidTexture(img); } catch (e) { return; }
            // Chia đều số ảnh rơi cho các tấm; tấm đầu nhận phần dư.
            const share = Math.floor(RAIN_PHOTO.count / urls.length) + (u < RAIN_PHOTO.count % urls.length ? 1 : 0);
            for (let i = 0; i < Math.max(1, share); i++) {
                const material = new THREE.MeshBasicMaterial({
                    map: tex.texture,
                    color: RAIN_PHOTO.tint,
                    transparent: true,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(plane, material);
                const base = { x: RAIN_PHOTO.width, y: RAIN_PHOTO.width * tex.aspect };
                mesh.scale.set(base.x, base.y, 1);
                const n = made++;
                // Rải theo lưới thưa lệch nhau để ảnh không chồng lên nhau.
                const x = -36 + ((n * 37) % 80) + Math.random() * 4;
                const z = -8 + ((n * 23) % 56) + Math.random() * 3;
                const item = {
                    kind: 'photo',
                    obj: mesh,
                    material,
                    base,
                    rain: new THREE.Vector3(x, 0, z),
                    home: { x, z },
                    top: 10 + Math.random() * 80,
                    floor: RAIN.textFloor - 4,
                    speed: randBetween(RAIN_PHOTO.speed),
                    tilt: (Math.random() - 0.5) * 0.5,
                    sway: Math.random() * Math.PI * 2,
                    g: 0,
                    delay: 0
                };
                resetRainFall(item);
                mesh.position.copy(item.rain);
                mesh.rotation.z = item.tilt;
                // Lớp riêng: RenderPass của bloom không thấy ảnh, ảnh được vẽ
                // thêm một lượt sau bloom để khỏi bị cháy sáng.
                mesh.layers.set(RAIN_PHOTO.layer);
                scene.add(mesh);
                rainItems.push(item);
            }
        };
        img.onerror = () => console.warn('Không tải được ảnh rơi:', url);
        img.src = url;
    });
}

// heart.obj của bản gốc: chỉ có v và f (v//vn), mặt tứ giác → tách tam giác.
function parseHeartObj(text) {
    const v = [];
    const vn = [];
    const pos = [];
    const nor = [];
    text.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') v.push(parts.slice(1, 4).map(Number));
        else if (parts[0] === 'vn') vn.push(parts.slice(1, 4).map(Number));
        else if (parts[0] === 'f') {
            const idx = parts.slice(1).map(token => token.split('/'));
            for (let i = 1; i < idx.length - 1; i++) {
                [idx[0], idx[i], idx[i + 1]].forEach(([vi, , ni]) => {
                    pos.push(...v[Number(vi) - 1]);
                    if (ni && vn[Number(ni) - 1]) nor.push(...vn[Number(ni) - 1]);
                });
            }
        }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (nor.length === pos.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    else geometry.computeVertexNormals();
    return geometry;
}

function loadHeartGeometry() {
    return fetch(`./assets/rain/heart.obj?v=${window.APP_VERSION || ''}`)
        .then(res => (res.ok ? res.text() : Promise.reject(res.status)))
        .then(parseHeartObj)
        .catch(err => {
            console.warn('Không nạp được heart.obj, dùng tim dựng sẵn:', err);
            return makeFallbackHeartGeometry();
        });
}

function makeFallbackHeartGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0, 3.5);
    s.bezierCurveTo(0, 6, -4.5, 7.5, -7, 4.5);
    s.bezierCurveTo(-9.5, 1.2, -6, -2.5, 0, -7.5);
    s.bezierCurveTo(6, -2.5, 9.5, 1.2, 7, 4.5);
    s.bezierCurveTo(4.5, 7.5, 0, 6, 0, 3.5);
    const geometry = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 2 });
    geometry.center();
    geometry.rotateX(Math.PI / 2);
    return geometry;
}

function createRainHearts(geometry) {
    // #e62e00 phát sáng 1.3 của bản gốc, sau khi đổi màu tuyến tính → sRGB thì
    // ra đỏ cam ~#ff3a00. r128 không quản lý màu nên đặt thẳng màu đích.
    const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: RAIN.heartColor,
        emissiveIntensity: 1,
        roughness: 0.6
    });
    for (let row = 0; row < RAIN.heartRows; row++) {
        for (let col = 0; col < RAIN.heartCols; col++) {
            const group = new THREE.Group();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            group.add(mesh);
            group.scale.setScalar(RAIN.heartScale);
            const item = {
                kind: 'heart',
                obj: group,
                mesh,
                base: RAIN.heartScale,
                rain: new THREE.Vector3(-40 + col * 6, 0, -8 + row * 6 * 1.5),
                home: { x: -40 + col * 6, z: -8 + row * 6 * 1.5 },
                top: randBetween(RAIN.heartTop),
                floor: RAIN.heartFloor,
                speed: randBetween(RAIN.heartSpeed),
                g: 0,
                delay: 0
            };
            resetRainFall(item);
            group.position.copy(item.rain);
            scene.add(group);
            rainItems.push(item);
        }
    }
}

// 1000 hạt trắng li ti bay lên, trôi ngang (particle-effect.js của bản gốc).
function createRainSparkles() {
    const count = RAIN.sparkles;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const k = i * 3;
        positions[k] = (Math.random() - 0.5) * 50;
        positions[k + 1] = (Math.random() - 0.5) * 100;
        positions[k + 2] = (Math.random() - 0.5) * 50;
        speeds[k] = (Math.random() - 0.5) * 0.1;
        speeds[k + 1] = 0.02 + Math.random() * 0.05;
        speeds[k + 2] = (Math.random() - 0.5) * 0.1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainSparkles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.03, color: 0xffffff }));
    rainSparkles.position.z = -1;
    rainSparkles.userData.speeds = speeds;
    scene.add(rainSparkles);
}

function updateRainSparkles(dt) {
    const attr = rainSparkles.geometry.attributes.position;
    const m = attr.array;
    const h = rainSparkles.userData.speeds;
    for (let k = 0; k < m.length; k += 3) {
        m[k] += h[k] * dt * 80;
        m[k + 1] += h[k + 1] * dt * 20;
        m[k + 2] += h[k + 2] * dt * 80;
        if (m[k + 1] > 25) {
            m[k + 1] = -25;
            m[k] = (Math.random() - 0.5) * 50;
            m[k + 2] = (Math.random() - 0.5) * 50;
        }
    }
    attr.needsUpdate = true;
}

// ---- TRÁI TIM NGÂN HÀ ----
// Toạ độ trong khung riêng của tim: gốc ở tâm, nửa bề ngang = 1, +z hướng về
// camera. rainGalaxy (Points) chính là khung đó: đặt ở hold.center, quay mặt
// về camera, phóng to rainHeartSize — nhờ vậy tim không bị méo khi camera lệch.
const GALAXY_VERT = `
    attribute float size;
    attribute float alpha;
    attribute vec3 tint;
    attribute float phase;
    uniform float uScale;
    uniform float uTime;
    varying vec3 vTint;
    varying float vAlpha;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.6 + phase);
        vTint = tint;
        vAlpha = alpha * twinkle;
        gl_PointSize = size * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
    }`;
const GALAXY_FRAG = `
    uniform float uOpacity;
    varying vec3 vTint;
    varying float vAlpha;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vTint, a * a * vAlpha * uOpacity);
    }`;

function createGalaxyHeart() {
    const n = GALAXY.count;
    const start = new Float32Array(n * 3);   // r, góc, z lúc bắt đầu (toạ độ cực)
    const slot = new Float32Array(n * 3);    // r, góc, z trên tim
    const delay = new Float32Array(n);
    const positions = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const alphas = new Float32Array(n);
    const tints = new Float32Array(n * 3);
    const phases = new Float32Array(n);
    const palette = ['#ff8fb1', '#ff5c8a', '#ffc2d4', '#fff0f5', '#ff9ec7', '#99DDFF'].map(c => new THREE.Color(c));

    for (let i = 0; i < n; i++) {
        // 30% nằm sát viền cho tim có nét, còn lại lấp đầy (dày dần ra ngoài).
        const edge = i % 10 < 3;
        const [hx, hy] = heartPoint(Math.random() * Math.PI * 2);
        const k = edge ? 0.97 + Math.random() * 0.06 : Math.pow(Math.random(), 0.45);
        const x = hx * k + (Math.random() - 0.5) * 0.03;
        const y = hy * k + (Math.random() - 0.5) * 0.03;
        const z = (Math.random() - 0.5) * 2 * GALAXY.depth * Math.sqrt(Math.max(0, 1 - k * k));
        slot[i * 3] = Math.hypot(x, y);
        slot[i * 3 + 1] = Math.atan2(y, x);
        slot[i * 3 + 2] = z;

        start[i * 3] = 2.2 + Math.random() * 2.2;
        start[i * 3 + 1] = Math.random() * Math.PI * 2;
        start[i * 3 + 2] = (Math.random() - 0.5) * 3;
        // Ở xa bay vào sau, viền thành hình cuối cùng.
        delay[i] = Math.random() * 0.35 + (edge ? 0.12 : 0);

        sizes[i] = edge ? 0.32 + Math.random() * 0.3 : 0.18 + Math.random() * 0.4;
        const c = edge && Math.random() < 0.5 ? palette[3] : palette[Math.floor(Math.random() * palette.length)];
        tints.set([c.r, c.g, c.b], i * 3);
        phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
        vertexShader: GALAXY_VERT,
        fragmentShader: GALAXY_FRAG,
        uniforms: {
            uScale: { value: 1 },
            uTime: { value: 0 },
            uOpacity: { value: 1 }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    rainGalaxy = new THREE.Points(geometry, material);
    rainGalaxy.frustumCulled = false;
    rainGalaxy.visible = false;
    rainGalaxy.userData = { start, slot, delay, spin: 0 };
    scene.add(rainGalaxy);
    updateGalaxyScale();
}

// Cỡ hạt tính theo pixel như PointsMaterial (chiều cao khung vẽ / 2).
function updateGalaxyScale() {
    if (!rainGalaxy) return;
    rainGalaxy.material.uniforms.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2;
}

// Chọn vai cho cú gom này: tim đỏ và chữ ở gần ngón tay nhất được gọi vào,
// còn lại vẫn rơi. Chỉ chọn lại khi cú gom trước đã tan hết.
function assignGatherRoles() {
    const byDistance = kind => rainItems
        .filter(item => item.kind === kind)
        .map(item => {
            const pos = item.obj.position;
            // Vật sau lưng camera hoặc quá gần ống kính thì không gọi.
            const behind = pos.z > camera.position.z - 6;
            const d = Math.hypot(pos.x - hold.center.x, pos.y - hold.center.y) + (behind ? 1e4 : 0);
            return { item, d };
        })
        .sort((a, b) => a.d - b.d);

    rainItems.forEach(item => { item.role = null; });
    byDistance('heart').slice(0, GALAXY.edgeHearts).forEach(({ item }, i) => {
        const [x, y] = heartPoint((i / GALAXY.edgeHearts) * Math.PI * 2);
        item.role = 'edge';
        item.slot = { x: x * 1.05, y: y * 1.05, z: 0.05 };
    });
    byDistance('text').slice(0, GALAXY.ringTexts).forEach(({ item }, i) => {
        item.role = 'ring';
        item.slot = { angle: (i / GALAXY.ringTexts) * Math.PI * 2 };
    });
    const reach = viewWidthAt(0) * 0.9;
    rainItems.forEach(item => {
        const pos = item.obj.position;
        const d = Math.hypot(pos.x - hold.center.x, pos.y - hold.center.y);
        item.delay = Math.min(0.4, (d / reach) * 0.4) + Math.random() * 0.08;
        item.phase = Math.random() * Math.PI * 2;
    });
}

const _local = new THREE.Vector3();

// Đặt khung tim ở tâm lốc, SONG SONG với màn hình (cùng hướng camera) — mặt
// phẳng song song màn hình thì phép chiếu không làm méo, kể cả ở mép với góc
// nhìn 100°. Quay mặt về vị trí camera thì tim lệch tâm bị kéo giãn.
function placeGalaxyFrame(scale, spinY) {
    rainGalaxy.position.copy(hold.center);
    rainGalaxy.quaternion.copy(camera.quaternion);
    rainGalaxy.rotateY(spinY);
    rainGalaxy.scale.setScalar(scale);
    rainGalaxy.updateMatrixWorld();
}

function updateGalaxyParticles(p, beat) {
    const { start, slot, delay } = rainGalaxy.userData;
    const geo = rainGalaxy.geometry;
    const pos = geo.attributes.position.array;
    const alpha = geo.attributes.alpha.array;
    let any = false;
    for (let i = 0; i < alpha.length; i++) {
        const g = THREE.MathUtils.clamp((p - delay[i]) / 0.55, 0, 1);
        const e = easeInOut(g);
        const k = i * 3;
        // Bay theo đường xoắn ốc: nội suy bán kính và góc, góc cộng thêm vài vòng.
        const r = (start[k] + (slot[k] - start[k]) * e) * beat;
        const a = start[k + 1] + (slot[k + 1] + GALAXY.turns * Math.PI * 2 - start[k + 1]) * e;
        pos[k] = Math.cos(a) * r;
        pos[k + 1] = Math.sin(a) * r;
        pos[k + 2] = start[k + 2] + (slot[k + 2] - start[k + 2]) * e;
        alpha[i] = Math.min(1, g * 2.2);
        if (g > 0) any = true;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
    rainGalaxy.visible = any;
}

// Bề ngang nửa trái tim (đơn vị thế giới ở z = 0): chiếm ~70% cạnh ngắn màn hình.
function updateHeartSize() {
    rainHeartSize = Math.min(viewWidthAt(0), viewHeightAt(0)) * 0.3;
    updateGalaxyScale();
}

// ---- GIỮ TAY ĐỂ GOM ----
let holdUi = null;

function buildHoldUi() {
    const hint = document.createElement('div');
    hint.className = 'hold-hint';
    hint.id = 'hold-hint';
    hint.innerHTML = `
        <span class="hold-hint-touch" aria-hidden="true">
            <i></i><i></i>
            <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </span>
        <span class="hold-hint-text">chạm &amp; giữ để gom yêu thương</span>`;
    document.body.appendChild(hint);

    const ring = document.createElement('div');
    ring.className = 'hold-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = `
        <svg viewBox="0 0 120 120">
            <circle class="hold-ring-track" cx="60" cy="60" r="52"/>
            <circle class="hold-ring-fill" cx="60" cy="60" r="52" pathLength="100"/>
        </svg>
        <span class="hold-ring-label">Giữ nguyên nhé…</span>`;
    document.body.appendChild(ring);

    holdUi = {
        hint,
        ring,
        fill: ring.querySelector('.hold-ring-fill'),
        label: ring.querySelector('.hold-ring-label')
    };
}

function setHintVisible(visible) {
    holdUi?.hint.classList.toggle('is-visible', visible);
}

function canStartHold(event) {
    if (rainExit || isPopupOpen || hold.active) return false;
    if (document.body.classList.contains('intro-open')) return false;
    if (typeof orbitOpen !== 'undefined' && orbitOpen) return false;
    // Vừa bấm nút đóng một overlay: cú chạm đó không phải cú giữ tay.
    if (Date.now() - lastClickTime < 350) return false;
    if (event.button != null && event.button > 0) return false;
    const target = event.target;
    return !(target && target.closest && target.closest('button, a, input, .music-toggle-button'));
}

function onHoldStart(event) {
    if (!canStartHold(event)) return;
    hold.active = true;
    hold.pointerId = event.pointerId;
    // Chạm lại khi lốc cũ chưa tan hết: đi tiếp từ mức đang có thay vì về 0,
    // không thì cả cơn lốc giật nở ra rồi mới siết lại.
    hold.start = performance.now() - hold.progress * HOLD_MS;
    hold.formed = false;
    hold.screen.x = event.clientX;
    hold.screen.y = event.clientY;
    heartCenterAt(event.clientX, event.clientY, hold.centerGoal);
    // Cú gom trước đã tan hết thì chọn lại vật được gọi theo chỗ ngón tay mới.
    if (!rainItems.some(item => item.g > 0) && hold.progress === 0) {
        hold.center.copy(hold.centerGoal);
        assignGatherRoles();
    }

    setHintVisible(false);
    holdUi.ring.classList.remove('is-formed');
    holdUi.label.textContent = 'Giữ nguyên nhé…';
    holdUi.ring.classList.add('is-active');
    moveHoldRing();
}

function onHoldMove(event) {
    if (!hold.active || event.pointerId !== hold.pointerId) return;
    hold.screen.x = event.clientX;
    hold.screen.y = event.clientY;
    heartCenterAt(event.clientX, event.clientY, hold.centerGoal);
    moveHoldRing();
}

function onHoldEnd(event) {
    if (!hold.active || event.pointerId !== hold.pointerId) return;
    hold.active = false;
    holdUi.ring.classList.remove('is-active', 'is-formed');

    if (hold.formed) {
        startRainExit();
        return;
    }
    // Thả sớm: lốc nới ra dần (updateHold) và mưa bay về chỗ cũ (g giảm về 0
    // trong updateRain), gợi ý hiện lại.
    setTimeout(() => {
        if (!hold.active && !rainExit && !isPopupOpen) setHintVisible(true);
    }, 900);
}

// Tâm trái tim: lệch về phía ngón tay một nửa, để tim to vẫn nằm gọn trong
// màn hình.
// Vòng đếm ngược vẫn bám đúng ngón tay.
const HEART_FOLLOW = 0.5;

function heartCenterAt(x, y, out) {
    const nx = ((x / window.innerWidth) * 2 - 1) * HEART_FOLLOW;
    const ny = ((y / window.innerHeight) * 2 - 1) * HEART_FOLLOW;
    screenToWorld(((nx + 1) / 2) * window.innerWidth, ((ny + 1) / 2) * window.innerHeight, out);
    return clampHeartCenter(out);
}

const _edgeX = new THREE.Vector3();
const _edgeY = new THREE.Vector3();
const _probe = new THREE.Vector3();

function clampHeartCenter(v) {
    // Góc nhìn 100° kéo giãn mạnh ở mép màn hình, nên đo thẳng: chiếu 4 điểm
    // mép tim lên màn hình rồi đẩy tâm vào cho đủ chỗ.
    const limit = 0.9;
    _edgeX.setFromMatrixColumn(camera.matrixWorld, 0);
    _edgeY.setFromMatrixColumn(camera.matrixWorld, 1);
    for (let pass = 0; pass < 4; pass++) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        [[1.12, 0], [-1.12, 0], [0, 1.05], [0, -1.1]].forEach(([ax, ay]) => {
            _probe.copy(v)
                .addScaledVector(_edgeX, ax * rainHeartSize)
                .addScaledVector(_edgeY, ay * rainHeartSize)
                .project(camera);
            minX = Math.min(minX, _probe.x);
            maxX = Math.max(maxX, _probe.x);
            minY = Math.min(minY, _probe.y);
            maxY = Math.max(maxY, _probe.y);
        });
        let dx = 0, dy = 0;
        if (maxX - minX > 2 * limit) dx = -(minX + maxX) / 2;
        else if (minX < -limit) dx = -limit - minX;
        else if (maxX > limit) dx = limit - maxX;
        if (maxY - minY > 2 * limit) dy = -(minY + maxY) / 2;
        else if (minY < -limit) dy = -limit - minY;
        else if (maxY > limit) dy = limit - maxY;
        if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) break;
        const c = _probe.copy(v).project(camera);
        screenToWorld(((c.x + dx + 1) / 2) * window.innerWidth, ((1 - (c.y + dy)) / 2) * window.innerHeight, v);
    }
    return v;
}

function moveHoldRing() {
    holdUi.ring.style.transform = `translate(${hold.screen.x}px, ${hold.screen.y}px)`;
    // Ngón tay sát mép: kéo nhãn vào trong cho khỏi tràn ra ngoài màn hình.
    const half = holdUi.label.offsetWidth / 2 + 12;
    const shift = Math.max(0, half - hold.screen.x) - Math.max(0, hold.screen.x + half - window.innerWidth);
    holdUi.ring.style.setProperty('--label-shift', `${shift}px`);
}

function updateHold(now, dt) {
    if (!hold.active) {
        if (!rainExit) hold.progress = Math.max(0, hold.progress - dt / 0.8);
        return;
    }
    hold.progress = Math.min(1, (now - hold.start) / HOLD_MS);
    holdUi.fill.style.strokeDashoffset = String(100 * (1 - hold.progress));
    if (hold.progress >= 1 && !hold.formed) {
        hold.formed = true;
        holdUi.ring.classList.add('is-formed');
        holdUi.label.textContent = 'Thả tay ra nhé ♥';
        moveHoldRing();
        if (navigator.vibrate) navigator.vibrate(35);
    }
}

// ---- VÒNG LẶP ----
function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const _target = new THREE.Vector3();
const _tint = new THREE.Color();

function rainTextColor(item) {
    // Màu hồng ↔ xanh theo sin(t / 2.5) như bản gốc. Tính trong không gian
    // tuyến tính, nhân độ sáng phát quang rồi mới đổi về sRGB.
    const t = (Math.sin((rainTime + item.hue) / RAIN.colorPeriod) + 1) / 2;
    _tint.lerpColors(RAIN.pink, RAIN.blue, t).multiplyScalar(RAIN.textGlow);
    _tint.setRGB(Math.min(1, _tint.r), Math.min(1, _tint.g), Math.min(1, _tint.b)).convertLinearToSRGB();
    item.material.color.copy(_tint);
}

function updateRain(dt, now) {
    if (rainExit) {
        updateRainFlight(dt, now, rainExit);
        return;
    }
    updateHold(now, dt);
    // Tâm lốc đuổi theo ngón tay.
    hold.center.lerp(hold.centerGoal, 1 - Math.exp(-dt * 10));

    const p = hold.progress;
    const ease = easeInOut(p);
    // Đã thành hình: tim đập nhẹ theo nhịp.
    const beat = hold.formed ? 1 + 0.045 * Math.pow(Math.sin(rainTime * 5.2), 8) : 1;
    const gathering = hold.active || p > 0;
    // Mưa chậm dần và mờ bớt để tim ngân hà nổi lên.
    const slow = 1 - 0.8 * ease;
    const dim = 1 - 0.75 * ease;
    // Vật đang rơi chắn giữa tim và camera thì gần như tắt hẳn.
    const hide = 1 - 0.95 * ease;
    const frontZ = hold.center.z + 3;
    // Điện thoại dọc hẹp: co vầng chữ cho khỏi tràn ra ngoài màn hình.
    const haloX = Math.min(GALAXY.haloX, (0.4 * viewWidthAt(0)) / rainHeartSize);

    if (rainGalaxy) {
        if (gathering) {
            // Xoay nhẹ quanh trục đứng lúc đang thành hình, rồi chỉ lắc rất khẽ.
            // Tim rất to và gần camera: lắc quá ~5° là nửa bên gần bị phóng to, méo.
            const spinY = (1 - ease) * 1.2 + Math.sin(rainTime * 0.7) * 0.08;
            placeGalaxyFrame(rainHeartSize, spinY);
            updateGalaxyParticles(p * 1.35, beat);
        } else if (rainGalaxy.visible) {
            updateGalaxyParticles(0, 1);
        }
        rainGalaxy.material.uniforms.uTime.value = rainTime;
    }

    rainItems.forEach(item => {
        const called = gathering && item.role;
        // Mưa chỉ dừng lại theo mức bị hút, để lúc thả tay vật thể bay về
        // đúng chỗ của nó trong cơn mưa thay vì nhảy cóc.
        item.rain.y -= item.speed * dt * (1 - item.g) * slow;
        if (item.rain.y < item.floor) item.rain.y += item.top - item.floor;

        const goal = called ? THREE.MathUtils.clamp((p * 1.6 - item.delay) / 0.8, 0, 1) : 0;
        item.g += (goal - item.g) * (1 - Math.exp(-dt * (gathering ? 3.2 : 2.2)));
        if (item.g < 0.0005) item.g = 0;

        const pos = item.obj.position;
        const inFront = !item.role && item.rain.z > frontZ;
        if (item.g === 0 || !item.role || !rainGalaxy) {
            pos.copy(item.rain);
        } else {
            if (item.role === 'edge') {
                _local.set(item.slot.x * beat, item.slot.y * beat, item.slot.z);
            } else {
                // Vầng chữ quay chậm quanh tim.
                const a = item.slot.angle + rainTime * 0.12;
                _local.set(Math.cos(a) * haloX, Math.sin(a) * GALAXY.haloY - 0.08, 0);
            }
            _target.copy(_local).applyMatrix4(rainGalaxy.matrixWorld);
            pos.lerpVectors(item.rain, _target, easeInOut(item.g));
        }

        if (item.kind === 'heart') {
            // Bản gốc: rotation.z += 0.01 mỗi khung hình.
            item.mesh.rotation.z += 0.6 * dt;
            const shrink = inFront ? hide : 1;
            item.obj.scale.setScalar(Math.max(0.0001, item.base * (1 - 0.55 * item.g) * shrink));
        } else {
            // Chữ trên vầng giữ nguyên cỡ để đọc được.
            item.obj.scale.set(item.base.x, item.base.y, 1);
            if (item.kind === 'text') rainTextColor(item);
            else item.obj.rotation.z = item.tilt + Math.sin(rainTime * 0.9 + item.sway) * 0.12;
            item.material.opacity = item.role ? dim + (1 - dim) * item.g : (inFront ? hide : dim);
        }
    });

    if (rainSparkles) updateRainSparkles(dt);
}

// ---- BAY XUYÊN MƯA ----
const _look = new THREE.Vector3();
const _ahead = new THREE.Vector3();

// Đặt một vật ra phía trước camera, quanh trục bay, chừa trống ở giữa để
// không có chữ nào đập thẳng vào mặt.
function placeInTunnel(vec, near, far, rMin, rMax) {
    const angle = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    vec.set(
        camera.position.x + Math.cos(angle) * r * 1.3,
        camera.position.y + Math.sin(angle) * r,
        camera.position.z - near - Math.random() * (far - near)
    );
}

function updateRainFlight(dt, now, exit) {
    const E = RAIN_EXIT;
    const t = now - exit.start;
    const p = Math.min(1, t / E.duration);
    const steer = easeInOut(Math.min(1, t / E.steer));

    // Camera: lái vào tâm tim, lao tới nhanh dần, FOV giãn ra.
    camera.position.set(
        exit.camFrom.x + (exit.aim.x - exit.camFrom.x) * steer,
        exit.camFrom.y + (exit.aim.y - exit.camFrom.y) * steer,
        exit.camFrom.z - E.distance * p * p
    );
    camera.fov = RAIN.fov + E.fovKick * THREE.MathUtils.smoothstep(p, 0.15, 0.75);
    camera.updateProjectionMatrix();
    _ahead.set(camera.position.x, camera.position.y, camera.position.z - 10);
    _look.lerpVectors(exit.lookFrom, _ahead, steer);
    camera.lookAt(_look);
    camera.updateMatrixWorld();

    // Nhịp đập trước khi bay: tim chữ phồng ra rồi về.
    const beat = t < E.pulse ? Math.sin((t / E.pulse) * Math.PI) * 0.12 : 0;
    const fadeOut = 1 - THREE.MathUtils.smoothstep(t, E.handoff - 250, E.handoff + 150);

    const wake = THREE.MathUtils.smoothstep(t, 0, 700);
    rainItems.forEach(item => {
        const pos = item.obj.position;
        const back = item.exitFrom + (1 - item.exitFrom) * wake;
        item.rain.y -= item.speed * dt * 0.3;
        if (t > E.tunnelFrom && item.rain.z > camera.position.z + 1) {
            placeInTunnel(item.rain, 15, 75, 7, 32);
        }
        if (beat) {
            pos.set(
                item.rain.x + (item.rain.x - exit.aim.x) * beat,
                item.rain.y + (item.rain.y - exit.aim.y) * beat,
                item.rain.z
            );
        } else {
            pos.copy(item.rain);
        }
        if (item.kind === 'heart') {
            item.mesh.rotation.z += 0.6 * dt;
            item.obj.scale.setScalar(Math.max(0.0001, item.base * fadeOut * back));
        } else {
            if (item.kind === 'text') rainTextColor(item);
            item.material.opacity = fadeOut * back;
        }
    });

    if (rainGalaxy && rainGalaxy.visible) {
        rainGalaxy.material.uniforms.uOpacity.value = fadeOut;
        rainGalaxy.material.uniforms.uTime.value = rainTime;
    }

    // Hạt sáng cũng đi theo đường hầm.
    if (rainSparkles) {
        const attr = rainSparkles.geometry.attributes.position;
        const m = attr.array;
        const z0 = rainSparkles.position.z;
        for (let k = 0; k < m.length; k += 3) {
            if (m[k + 2] + z0 > camera.position.z + 1) {
                placeInTunnel(_target, 5, 90, 1, 30);
                m[k] = _target.x;
                m[k + 1] = _target.y;
                m[k + 2] = _target.z - z0;
            }
        }
        attr.needsUpdate = true;
    }

    // Đốm sáng cuối đường hầm: nằm đúng điểm màn hình của tim màn 2.
    const glowP = THREE.MathUtils.smoothstep(t, E.glowStart, E.glowFull);
    rainGlow.visible = glowP > 0;
    if (rainGlow.visible) {
        const d = 8;
        const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        rainGlow.position.set(exit.ndc.x * halfH * camera.aspect, exit.ndc.y * halfH, -d);
        rainGlow.scale.setScalar(halfH * 2 * (0.03 + 2.4 * glowP * glowP));
        rainGlow.material.opacity = Math.min(1, glowP * 1.6);
    }
    if (rainBloom) rainBloom.strength = RAIN.bloom.strength + (E.bloomPeak - RAIN.bloom.strength) * glowP;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, rainClock.getDelta());
    // Orbit đã che kín màn hình: khỏi tính, khỏi vẽ.
    if (!isPlaying && !rainExit) return;
    rainTime += dt;
    updateRain(dt, performance.now());
    if (rainComposer) rainComposer.render();
    else renderer.render(scene, camera);
    renderRainPhotos();
}

// Lượt vẽ thứ hai chỉ cho ảnh rơi, chồng lên khung hình đã có bloom. Tắt nền
// và autoClear để không xoá mất lượt trước.
function renderRainPhotos() {
    if (!rainItems.some(item => item.kind === 'photo')) return;
    const background = scene.background;
    scene.background = null;
    renderer.autoClear = false;
    renderer.clearDepth();
    camera.layers.set(RAIN_PHOTO.layer);
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.autoClear = true;
    scene.background = background;
}

// ---- CHUYỂN CẢNH SANG MÀN 2: BAY XUYÊN MƯA ----
// 0      trái tim ngân hà đứng yên tại chỗ, đập một nhịp
// 0–1300 camera chậm rãi lái vào tâm tim, xuyên qua tim ở ~1,4 s, vào hầm lời yêu
// 1700   đốm sáng hiện ở đúng chỗ tim màn 2, to dần, bloom mạnh dần
// 2700   trời ngân hà màn 2 hiện ra (openMemoryOrbit 'arrive'), lớp tối phủ dần
// 3200   trao tay: tim màn 2 nở, ảnh bay ra quỹ đạo
// Chạm màn hình giữa chừng → tua thẳng tới cuối.
function startRainExit() {
    if (rainExit) return;
    if (typeof buildOrbitScene === 'function') buildOrbitScene();

    const flash = spawnConstellationFlash(hold.screen.x, hold.screen.y);
    setTimeout(() => flash.remove(), 1000);

    if (prefersReducedMotion()) {
        openMemoryOrbit();
        resetRainGather();
        return;
    }

    // Đích của đốm sáng là tâm trái tim màn 2: overlay còn ẩn nhưng đã có layout.
    const heart = document.getElementById('orbit-heart')?.getBoundingClientRect();
    const sx = heart && heart.width ? heart.left + heart.width / 2 : window.innerWidth / 2;
    const sy = heart && heart.width ? heart.top + heart.height / 2 : window.innerHeight / 2;

    // Tim chữ đứng yên đúng chỗ đang hiện để camera bay xuyên qua nó.
    rainItems.forEach(item => {
        item.rain.copy(item.obj.position);
        item.g = 0;
        // Mức mờ/co lúc thả tay — cú bay đưa dần về bình thường, không bật sáng.
        item.exitFrom = item.kind === 'heart' ? item.obj.scale.x / item.base : item.material.opacity;
    });

    const exit = {
        start: performance.now(),
        camFrom: camera.position.clone(),
        lookFrom: new THREE.Vector3(0, 0, 0),
        aim: hold.center.clone(),
        ndc: { x: (sx / window.innerWidth) * 2 - 1, y: -(sy / window.innerHeight) * 2 + 1 },
        timers: [],
        anims: []
    };
    rainExit = exit;
    setHintVisible(false);

    const at = (ms, fn) => exit.timers.push(setTimeout(() => {
        if (rainExit === exit) fn();
    }, ms));
    const veil = document.getElementById('sky-veil');
    if (veil) {
        exit.anims.push(veil.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: RAIN_EXIT.veilDur,
            delay: RAIN_EXIT.veilStart,
            easing: 'ease-in',
            fill: 'forwards'
        }));
    }
    at(RAIN_EXIT.orbitOpen, () => openMemoryOrbit({ mode: 'arrive' }));
    at(RAIN_EXIT.handoff, () => beginOrbitArrival());
    at(RAIN_EXIT.handoff + ARRIVAL.done + 20, finishRainExit);
    // Đăng ký sau một nhịp để cú thả tay vừa rồi không tự tua luôn.
    at(250, () => document.addEventListener('pointerdown', skipRainExit, true));
}

function skipRainExit() {
    if (!rainExit) return;
    if (typeof orbitOpen !== 'undefined' && !orbitOpen) openMemoryOrbit({ mode: 'arrive' });
    if (typeof finishOrbitArrival === 'function') finishOrbitArrival();
    finishRainExit();
}

function finishRainExit() {
    const exit = rainExit;
    if (!exit) return;
    exit.timers.forEach(clearTimeout);
    document.removeEventListener('pointerdown', skipRainExit, true);
    rainExit = null;
    // Màn 2 che kín rồi: dừng màn 1 cho nhẹ máy. Mưa được trả về trạng thái
    // rơi tự do, để lúc đóng orbit người xem quay lại một cơn mưa mới.
    isPlaying = false;
    resetRainGather();
    // Giữ lớp tối tới khi đóng orbit (restoreRainSky) — gỡ bây giờ thì màn 1
    // lóe lên sau lớp trong suốt của orbit lúc nó đang fade.
    exit.anims.forEach(anim => anim.finish());
    rainExitAnims = exit.anims;
}

let rainExitAnims = [];

function resetRainGather() {
    hold.active = false;
    hold.progress = 0;
    hold.formed = false;
    rainItems.forEach(item => {
        item.g = 0;
        item.rain.x = item.home.x;
        item.rain.z = item.home.z;
        resetRainFall(item);
        item.obj.position.copy(item.rain);
        if (item.material) item.material.opacity = 1;
        if (item.kind === 'heart') item.obj.scale.setScalar(item.base);
        else item.obj.scale.set(item.base.x, item.base.y, 1);
    });
    // Hạt sáng về lại khối ban đầu quanh gốc toạ độ.
    if (rainSparkles) {
        const m = rainSparkles.geometry.attributes.position.array;
        for (let k = 0; k < m.length; k += 3) {
            m[k] = (Math.random() - 0.5) * 50;
            m[k + 1] = (Math.random() - 0.5) * 100;
            m[k + 2] = (Math.random() - 0.5) * 50;
        }
        rainSparkles.geometry.attributes.position.needsUpdate = true;
    }
    camera.position.set(RAIN.camX, 0, RAIN.camZ);
    camera.fov = RAIN.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    if (rainGlow) {
        rainGlow.visible = false;
        rainGlow.material.opacity = 0;
    }
    if (rainBloom) rainBloom.strength = RAIN.bloom.strength;
    if (rainGalaxy) {
        rainGalaxy.geometry.attributes.alpha.array.fill(0);
        rainGalaxy.geometry.attributes.alpha.needsUpdate = true;
        rainGalaxy.material.uniforms.uOpacity.value = 1;
        rainGalaxy.visible = false;
    }
    rainItems.forEach(item => { item.role = null; });
}

// orbit.js gọi khi đóng màn 2 (nút ×): trả lại bầu trời mưa.
function restoreRainSky() {
    if (rainExit) {
        rainExit.timers.forEach(clearTimeout);
        document.removeEventListener('pointerdown', skipRainExit, true);
        rainExit = null;
        resetRainGather();
    }
    rainExitAnims.forEach(anim => anim.cancel());
    rainExitAnims = [];
    setHintVisible(true);
}

// ---- KHUNG HÌNH ----
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (rainComposer) rainComposer.setSize(window.innerWidth, window.innerHeight);
    updateHeartSize();
}

// ---- KHỞI ĐỘNG ----
// Font Mali phải có sẵn trước khi vẽ texture chữ, không thì canvas vẽ bằng
// font dự phòng và giữ nguyên như vậy mãi.
function waitForFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const timeout = new Promise(resolve => setTimeout(resolve, 2500));
    return Promise.race([document.fonts.load("96px 'Mali'").catch(() => {}), timeout]);
}

function bootRain() {
    initRainScene();
    createRainSparkles();
    buildHoldUi();
    updateHeartSize();

    Promise.all([waitForFont(), loadHeartGeometry()]).then(([, heartGeometry]) => {
        createRainTexts();
        createRainHearts(heartGeometry);
        createRainPhotos();
        createGalaxyHeart();
        isPlaying = true;
        animate();
        hideLoading();
        window.rainReady = true;
        document.dispatchEvent(new Event('rain:ready'));
        // Còn màn mở đầu (intro.js) thì để nó tự bật gợi ý khi mưa đã đổ xuống.
        setTimeout(() => {
            if (!document.body.classList.contains('intro-open')) setHintVisible(true);
        }, 900);
    });

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pointerdown', onHoldStart);
    window.addEventListener('pointermove', onHoldMove);
    window.addEventListener('pointerup', onHoldEnd);
    window.addEventListener('pointercancel', onHoldEnd);
    // Giữ tay lâu trên Android bật menu ngữ cảnh, trên desktop là chuột phải.
    window.addEventListener('contextmenu', event => {
        if (!isPopupOpen) event.preventDefault();
    });

    // Không có nhạc người dùng → không hiện nút loa, không tự phát
    if (customMusic) {
        createMusicToggleButton();
        primeAutoplayOnFirstTouch();
    }

    // Nạp trước ảnh của màn 2 khi màn 1 đã chạy ổn định, để lúc thả tay ảnh
    // bay ra quỹ đạo không bị ô trống.
    setTimeout(() => {
        orbitMemories.forEach(part => {
            if (!part.photo) return;
            const img = new Image();
            img.src = part.photo;
            preloadedPopupImages.push(img);
        });
    }, 2500);

    console.log(`Mưa ${rainMessages.length} lời yêu, ${orbitMemories.length} ký ức, gửi tới: ${recipientName}`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRain, { once: true });
} else {
    bootRain();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        isPlaying = false;
        return;
    }
    // Màn 2 đang che kín: giữ màn 1 tắt.
    isPlaying = typeof orbitOpen === 'undefined' || !orbitOpen;
    // Bỏ khoảng thời gian tab bị ẩn, không thì frame đầu tiên nhảy cóc.
    rainClock?.getDelta();
});
// ---- TRÁI TIM NGÂN HÀ (Memory Orbit) ----
//
// Màn kết: một trái tim phát sáng ở giữa, các tấm ảnh của từng lời nhắn bay
// quanh nó trên một quỹ đạo ellipse. Chạm một tấm ảnh là đọc lại lời nhắn của
// nó; chạm trái tim là mở lá thư hoàn chỉnh.
//
// Port từ dự án `traitimnganha` (Next.js + React) sang vanilla. Bản gốc ghi rõ
// trong README của nó: "Everything is DOM and CSS — no canvas, no WebGL, no
// animation library", nên phần phải chuyển chỉ là cú pháp React, còn toán quỹ
// đạo và các hằng số nhịp điệu giữ nguyên.
//
// File tách riêng khỏi script.js (đã hơn 1600 dòng) nhưng vẫn là script thường
// dùng chung global scope, đúng kiểu đang có của dự án — không module, không
// build step.

// ---- HẰNG SỐ NHỊP ĐIỆU (giữ nguyên số của bản gốc) ----
const ORBIT_PERIOD_S = 52;        // một vòng quỹ đạo
const ORBIT_PERIOD_REDUCED_S = 96; // khi bật giảm chuyển động
const ORBIT_SURGE_EVERY_S = 11;   // chu kỳ tăng tốc
const ORBIT_SURGE_DUR_S = 0.75;   // thời gian mỗi cú tăng tốc
const ORBIT_SURGE_FACTOR = 4;     // tăng tốc gấp mấy lần
const ORBIT_SPINUP_S = 2.2;       // quay nhanh lúc mở rồi lắng dần
const ORBIT_CARD_CLOSE_MS = 400;  // khớp với thời lượng animation thoát của card

let orbitBuilt = false;
let orbitOpen = false;
let orbitFrame = 0;
let orbitRotation = 0;
let orbitElapsed = 0;
let orbitClock = 0;
let orbitPrevTime = null;
let orbitTokens = [];
let orbitLines = [];
let orbitStageSize = { w: 0, h: 0 };
let orbitResizeObserver = null;
let orbitCardIndex = -1;
let orbitTier = null;

const HEART_TAP_TARGET = 3;
const HEART_BURST_MS = 2700;
let heartCharge = 0;
let isHeartBursting = false;
let isFinalLetterUnlocked = false;
let lastHeartTapTime = -Infinity;
let heartBurstTimer = null;
let heartBeatAnimation = null;
// Nhịp chạm làm quỹ đạo chậm lại rồi đi tiếp. PHẢI là đường cong mềm: bản
// trước nhân tốc độ với 0.3 trong đúng một khung hình rồi bật lại 1 sau 420ms
// — cả 7 tấm ảnh khựng rồi vọt, chính là cảm giác "giật giật" khi chạm tim.
let heartSlowStart = -Infinity;
const HEART_SLOW_MS = 800;
// Nhịp thứ 3: phanh quỹ đạo về 0 rồi mới dừng vòng rAF, thay vì đứng khựng.
let orbitBrake = null;
let heartAmbientTimer = null;
let heartAmbientRunId = 0;

const HEART_AMBIENT = [
    { interval: 1650, regular: 4, lite: 2 },
    { interval: 1450, regular: 6, lite: 3 },
    { interval: 1250, regular: 8, lite: 4 }
];

function updateHeartCharge() {
    const progress = document.getElementById('heart-progress-wrap');
    if (!progress) return;
    progress.setAttribute('aria-valuenow', String(heartCharge));
    document.getElementById('heart-progress-fill').style.transform = `scaleX(${heartCharge / HEART_TAP_TARGET})`;
    document.getElementById('heart-progress-label').textContent = isFinalLetterUnlocked
        ? 'Lá thư đã mở' : `${heartCharge}/${HEART_TAP_TARGET} nhịp tim`;
    const hint = document.getElementById('heart-progress-hint');
    if (hint) {
        const hints = ['Chạm vào trái tim để mở lá thư', 'Thêm hai nhịp nữa thôi', 'Một nhịp cuối cùng…'];
        hint.textContent = isFinalLetterUnlocked ? 'Chạm để đọc lại lá thư'
            : hints[Math.min(heartCharge, hints.length - 1)];
    }
    document.getElementById('orbit-heart').setAttribute('aria-label', isFinalLetterUnlocked
        ? 'Mở lại lá thư' : `Mở lá thư, đã đủ ${heartCharge} trên ${HEART_TAP_TARGET} nhịp`);
    const stage = document.getElementById('orbit-stage');
    const level = isFinalLetterUnlocked ? 0 : Math.min(heartCharge, HEART_AMBIENT.length - 1);
    // Nhịp đập nhanh dần theo số lần chạm bằng playbackRate — KHÔNG đổi
    // animation-duration: đổi thời lượng của một animation đang chạy làm trình
    // duyệt tính lại tiến độ theo thời lượng mới và trái tim nhảy sang pha
    // khác. updatePlaybackRate() giữ nguyên vị trí hiện tại.
    const pulse = document.querySelector('.ol-heart')?.getAnimations?.()
        .find(anim => anim.animationName === 'ol-heart-pulse');
    pulse?.updatePlaybackRate(HEART_AMBIENT[0].interval / HEART_AMBIENT[level].interval);
}

function heartAmbientAllowed() {
    return orbitOpen
        && !orbitArrival
        && !document.hidden
        && !orbitReduced()
        && !isHeartBursting
        && orbitCardIndex < 0
        && !document.getElementById('full-letter')?.classList.contains('is-open');
}

function stopHeartAmbient(removeHearts = false) {
    heartAmbientRunId++;
    clearTimeout(heartAmbientTimer);
    heartAmbientTimer = null;
    document.getElementById('orbit-stage')?.classList.add('is-heart-paused');
    if (removeHearts) releaseAllHearts();
}

function startHeartAmbient() {
    stopHeartAmbient(false);
    if (!heartAmbientAllowed()) return;

    const stage = document.getElementById('orbit-stage');
    stage?.classList.remove('is-heart-paused');
    const runId = heartAmbientRunId;

    const beat = () => {
        if (runId !== heartAmbientRunId || !heartAmbientAllowed()) return;
        const level = isFinalLetterUnlocked ? 0 : Math.min(heartCharge, HEART_AMBIENT.length - 1);
        const config = HEART_AMBIENT[level];
        // Rải số tim của nhịp này đều ra cả khoảng interval (jitter), để vòi
        // phun chảy liên tục chứ không bật từng cụm theo nhịp đập.
        spawnFountainHearts(orbitDeviceTier().lite ? config.lite : config.regular, {
            jitter: config.interval
        });
        heartAmbientTimer = setTimeout(beat, config.interval);
    };

    // Cho màn orbit kịp hiện rõ rồi mới thả cụm tim đầu tiên.
    heartAmbientTimer = setTimeout(beat, 380);
}

function syncHeartAmbientState() {
    if (heartAmbientAllowed()) startHeartAmbient();
    else stopHeartAmbient(false);
}

function clearHeartEffects() {
    stopHeartAmbient(true);
    clearTimeout(heartBurstTimer);
    heartBurstTimer = null;
    heartBeatAnimation?.cancel();
    heartBeatAnimation = null;
    heartSlowStart = -Infinity;
    orbitBrake = null;
    document.querySelectorAll('.ol-heart-effect').forEach(node => node.remove());
    document.getElementById('orbit-stage')?.classList.remove('is-heart-bursting');
    releaseAllHearts();
    resetOrbitZoom(true);
}

function resetHeartCharge() {
    clearHeartEffects();
    heartCharge = 0;
    isHeartBursting = false;
    isFinalLetterUnlocked = false;
    lastHeartTapTime = -Infinity;
    updateHeartCharge();
}

const HEART_FLOAT_IMAGES = [
    './tim/heart-watercolor-pink.svg',
    './tim/heart-watercolor-coral.svg',
    './tim/heart-watercolor-plum.svg'
];
// Nạp trước để cụm đầu tiên không xuất hiện trễ trong lúc ảnh vừa tải.
HEART_FLOAT_IMAGES.forEach(src => {
    const image = new Image();
    image.src = src;
});

// ---- TIM BÓNG (glossy) ----
// Tim trong video tham chiếu bóng như thạch: đậm ở đáy, highlight trắng ở góc
// trên trái. Ba ảnh watercolor ở trên mềm quá khi chỉ còn 14–20px, nên sinh
// thêm 5 tông SVG ngay tại chỗ — không thêm file ảnh nào.
const GLOSS_TONES = [
    ['#ffc2d4', '#e8577f'], // hồng
    ['#ffd0c2', '#e0706a'], // san hô
    ['#e6d4ff', '#9c7ad6'], // oải hương
    ['#ffe0c8', '#e79a6a'], // đào
    ['#ffb3c1', '#c93b62']  // đỏ hồng
];

function glossHeartSvg([light, deep]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 58">
<defs><radialGradient id="g" cx="36%" cy="28%" r="78%">
<stop offset="0" stop-color="#fff" stop-opacity=".95"/>
<stop offset=".3" stop-color="${light}"/>
<stop offset="1" stop-color="${deep}"/>
</radialGradient></defs>
<path d="M32 56C10 40 2 30 2 18A15 15 0 0 1 32 10A15 15 0 0 1 62 18C62 30 54 40 32 56Z" fill="url(#g)" fill-opacity=".94"/>
<ellipse cx="19" cy="17" rx="7" ry="4.2" fill="#fff" fill-opacity=".72" transform="rotate(-32 19 17)"/>
</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const HEART_GLOSS_IMAGES = GLOSS_TONES.map(glossHeartSvg);

// 70% tim bóng, 30% watercolor — giữ chút chất màu nước của trái tim chính.
function pickHeartImage() {
    return Math.random() < 0.7
        ? HEART_GLOSS_IMAGES[Math.floor(Math.random() * HEART_GLOSS_IMAGES.length)]
        : HEART_FLOAT_IMAGES[Math.floor(Math.random() * HEART_FLOAT_IMAGES.length)];
}

// ---- VÒI PHUN TIM (DOM pool) ----
// Bản trước tạo <img> mới cho mỗi chiếc tim rồi setTimeout(remove) — tới 120
// node sinh ra rồi bỏ đi liên tục suốt lúc màn orbit mở. Giờ dựng sẵn một pool
// cố định, tim bay xong thì trả về pool: số node không đổi suốt buổi xem.
const HEART_POOL_SIZE = { lite: 16, regular: 34 };
let heartPool = [];
let orbitHeartW = 320; // bề rộng khung trái tim chính, đo lại khi resize

function buildHeartPool(container, size) {
    heartPool = Array.from({ length: size }, () => {
        const node = document.createElement('img');
        node.className = 'ol-fountain-heart';
        node.alt = '';
        node.decoding = 'async';
        node.draggable = false;
        node.setAttribute('aria-hidden', 'true');
        container.appendChild(node);
        return { node, busy: false, anim: null };
    });
}

function acquireHeart() {
    const item = heartPool.find(h => !h.busy);
    if (item) item.busy = true;
    return item || null;
}

function releaseHeart(item) {
    item.anim?.cancel();
    item.anim = null;
    item.busy = false;
}

function releaseAllHearts() {
    heartPool.forEach(releaseHeart);
}

// Tim chui ra từ SAU hõm trái tim chính rồi phun lên theo hình quạt, vọt nhanh
// rồi lơ lửng và tan ở độ cao cỡ một trái tim — đúng nhịp giây 3–9 của video
// tham chiếu. `spread` là nửa góc quạt (độ), `reach` là quãng bay theo bề
// rộng trái tim.
function spawnFountainHearts(count, options = {}) {
    if (orbitReduced() || count <= 0) return;
    const W = orbitHeartW;
    const spread = options.spread ?? 48;
    const [reachMin, reachMax] = options.reach ?? [0.55, 1.05];
    const [durMin, durMax] = options.duration ?? [2600, 3600];

    for (let i = 0; i < count; i++) {
        const item = acquireHeart();
        if (!item) return;
        const { node } = item;
        const angle = (-90 + (Math.random() * 2 - 1) * spread) * Math.PI / 180;
        const dist = W * (reachMin + Math.random() * (reachMax - reachMin));
        const ox = (Math.random() - 0.5) * W * 0.2;
        const oy = -W * 0.18;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const sway = (Math.random() - 0.5) * 28;
        const rot = -20 + Math.random() * 40;
        // Đa số tim nhỏ; thỉnh thoảng một chiếc to hơn cho có nhịp.
        const size = Math.random() < 0.7 ? 14 + Math.random() * 7 : 21 + Math.random() * 10;
        const scale = options.scale ?? 1;
        const duration = durMin + Math.random() * (durMax - durMin);
        const at = (fx, fy, s, r) =>
            `translate(-50%, -50%) translate(${(ox + fx).toFixed(1)}px, ${(oy + fy).toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${r.toFixed(1)}deg)`;

        node.src = pickHeartImage();
        node.style.width = `${(size * scale).toFixed(1)}px`;
        item.anim = node.animate([
            { transform: at(0, 0, 0.3, 0), opacity: 0 },
            { transform: at(dx * 0.12, dy * 0.12, 1, rot * 0.2), opacity: 1, offset: 0.15 },
            { transform: at(dx * 0.6 + sway, dy * 0.6, 1, rot * 0.6), opacity: 1, offset: 0.55 },
            { transform: at(dx, dy, 0.85, rot), opacity: 0 }
        ], {
            duration,
            delay: (options.delay || 0) + Math.random() * (options.jitter ?? 260),
            easing: 'cubic-bezier(.15, .6, .3, 1)',
            fill: 'both'
        });
        item.anim.onfinish = () => releaseHeart(item);
    }
}

// ---- TIM VỆ TINH TRÊN VÒNG QUỸ ĐẠO ----
// Vòng quỹ đạo nghiêng ôm trái tim chính (toạ độ theo đơn vị = 1% bề rộng tim,
// khớp đúng với svg .ol-orbit-back/.ol-orbit-front dựng trong buildOrbitScene).
// Vài chiếc tim to bay trên vòng này, đi qua TRƯỚC rồi vòng ra SAU tim chính —
// thứ tạo chiều sâu trong traitim1.png.
const HEART_RING = { rx: 78, ry: 20, cy: 8, tilt: -14 };
let satellites = [];

function buildSatellites(container, count) {
    satellites = Array.from({ length: count }, (_, i) => {
        const node = document.createElement('img');
        node.className = 'ol-satellite';
        node.alt = '';
        node.decoding = 'async';
        node.draggable = false;
        node.setAttribute('aria-hidden', 'true');
        node.src = HEART_GLOSS_IMAGES[(i * 2) % HEART_GLOSS_IMAGES.length];
        node.style.width = `${[40, 32, 36][i % 3]}px`;
        container.appendChild(node);
        return { node, phase: (Math.PI * 2 * i) / count + 0.4, tilt: [-12, 14, -6][i % 3] };
    });
}

function layoutSatellites(rotation) {
    if (satellites.length === 0) return;
    const unit = orbitHeartW / 100;
    const t = (HEART_RING.tilt * Math.PI) / 180;
    const cos = Math.cos(t), sin = Math.sin(t);
    // Kích thước gốc tính cho tim 320px; trên điện thoại tim chỉ còn ~200px.
    const fit = Math.min(1, Math.max(0.68, orbitHeartW / 320));
    satellites.forEach(s => {
        const a = rotation + s.phase;
        const x0 = Math.cos(a) * HEART_RING.rx;
        const y0 = Math.sin(a) * HEART_RING.ry;
        const x = (x0 * cos - y0 * sin) * unit;
        const y = (x0 * sin + y0 * cos + HEART_RING.cy) * unit;
        // sin(a) > 0 là nửa dưới của ellipse = nửa phía trước tim chính.
        const depth = (Math.sin(a) + 1) / 2;
        s.node.style.transform =
            `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${((0.66 + 0.46 * depth) * fit).toFixed(3)}) rotate(${s.tilt}deg)`;
        s.node.style.zIndex = depth > 0.5 ? '7' : '3';
        s.node.style.opacity = ((0.5 + 0.5 * depth) * arrivalProgress(ARRIVAL.satStart, ARRIVAL.satDur)).toFixed(3);
    });
}

function spawnHeartEffects(finalBurst = false) {
    if (orbitReduced()) return;
    // Tim/hạt sáng bay ra nằm ở lớp RIÊNG (#heart-burst), không phải con của
    // #heart-charge — xem chú thích ở HTML. Vòng nhẫn shockwave thì vẫn hợp lý
    // khi bám theo nhịp phóng to của #heart-charge nên giữ nguyên ở đó.
    const ring = document.getElementById('heart-charge');
    const burst = document.getElementById('heart-burst');
    const add = (target, className, x, y, delay = 0, life = 2200) => {
        const node = document.createElement('span');
        node.className = `ol-heart-effect ${className}`;
        node.style.setProperty('--dx', `${x}px`);
        node.style.setProperty('--dy', `${y}px`);
        node.style.animationDelay = `${delay}ms`;
        target.appendChild(node);
        setTimeout(() => node.remove(), life);
        return node;
    };
    add(ring, 'ol-heart-pulse-ring', 0, 0);
    if (finalBurst) {
        add(ring, 'ol-heart-pulse-ring', 0, 0, 130);
        add(ring, 'ol-heart-pulse-ring', 0, 0, 300);
        formHeartRing(burst);
        return;
    }
    const count = orbitDeviceTier().lite ? 6 : 6 + heartCharge;
    const radius = Math.min(burst.clientWidth * (1.15 + heartCharge * 0.08), 300);
    for (let i = 0; i < count; i++) {
        const t = (i * 2 * Math.PI) / count;
        add(burst, 'ol-heart-particle', Math.cos(t) * radius, Math.sin(t) * radius);
    }
}

// ---- CAO TRÀO: TIM XẾP THÀNH VÀNH TRÁI TIM ----
// Giây 10–11 của video: chùm tim không nổ tung ngẫu nhiên mà bay từ tâm ra
// ĐÁP đúng vào các điểm trên một đường cong trái tim lớn quanh tim chính, nhún
// nhẹ tại chỗ, rồi theo cú zoom bay tản ra mép màn hình.
const HEART_FORM_SCALE = 1.75; // vành tim so với bề rộng trái tim chính

function formHeartRing(burst) {
    const count = orbitDeviceTier().lite ? 20 : 36;
    const W = orbitHeartW * HEART_FORM_SCALE;
    const total = HEART_BURST_MS;

    for (let i = 0; i < count; i++) {
        const [nx, ny] = heartCurveNormalized((Math.PI * 2 * i) / count);
        // Tâm hình học của đường cong ~ y 45%, trái tim chính nằm hơi thấp
        // trong khung (58% là mũi nhọn) nên đẩy cả vành xuống 4%.
        const x = ((nx - 50) / 100) * W;
        const y = ((ny - 45) / 100) * W * 0.92 + orbitHeartW * 0.04;
        const size = 20 + Math.random() * 14;
        const rot = -18 + Math.random() * 36;
        const delay = i * 6;
        const at = (fx, fy, sc, r) =>
            `translate(-50%, -50%) translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px) scale(${sc}) rotate(${r.toFixed(1)}deg)`;
        const bob = (i % 2 ? 1 : -1) * 4;

        const node = document.createElement('img');
        node.className = 'ol-heart-effect ol-form-heart';
        node.src = pickHeartImage();
        node.alt = '';
        node.draggable = false;
        node.style.width = `${size.toFixed(1)}px`;
        burst.appendChild(node);
        // Mốc thời gian (phần trăm của `total`) khớp với completeHeartCharge:
        // 0–33% bay ra đáp chỗ · 33–58% nhún tại chỗ · 58–100% theo cú zoom
        // bay tản ra xa gấp 2,4 lần.
        node.animate([
            { transform: at(0, 0, 0.2, 0), opacity: 0 },
            { transform: at(x, y, 1.12, rot), opacity: 1, offset: 0.26 },
            { transform: at(x, y, 1, rot), opacity: 1, offset: 0.33 },
            { transform: at(x, y + bob, 1.05, rot * 0.7), opacity: 1, offset: 0.46 },
            { transform: at(x, y, 1, rot), opacity: 1, offset: 0.58 },
            { transform: at(x * 2.4, y * 2.4, 1.6, rot * 1.6), opacity: 0 }
        ], { duration: total - delay, delay, easing: 'cubic-bezier(.3, .1, .3, 1)', fill: 'both' });
        // Lifetime phải phủ hết delay + duration, không thì tim bị gỡ giữa
        // đường bay (bài học ở plan-03 D).
        setTimeout(() => node.remove(), total + 400);
    }
}

// ---- ZOOM VÀO TRÁI TIM ----
let orbitZoomAnimation = null;
let orbitVeilAnimation = null;

function playOrbitZoom(delayMs, durationMs) {
    const stage = document.getElementById('orbit-stage');
    const heart = document.getElementById('orbit-heart');
    const veil = document.getElementById('orbit-zoom-veil');
    if (!stage || !heart) return;
    const s = stage.getBoundingClientRect();
    const h = heart.getBoundingClientRect();
    stage.style.transformOrigin = `${h.left + h.width / 2 - s.left}px ${h.top + h.height * 0.52 - s.top}px`;
    // will-change: rasterize sân khấu một lần rồi phóng texture lên. Không có
    // nó, trình duyệt vẽ lại cả sân khấu (ảnh, bóng đổ, blur) ở từng mức zoom
    // trung gian — trên điện thoại là tụt khung ngay đoạn đẹp nhất. Không đổi
    // opacity của cả sân khấu nữa: lớp phủ màu tim đã che dần, còn opacity
    // nhóm trên một layer lớn như vậy là thêm một lượt vẽ offscreen mỗi frame.
    stage.style.willChange = 'transform';
    orbitZoomAnimation = stage.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(3.2)' }
    ], { duration: durationMs, delay: delayMs, easing: 'cubic-bezier(.55, 0, .75, .4)', fill: 'both' });
    if (veil) {
        orbitVeilAnimation = veil.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 420, delay: delayMs + durationMs - 260, easing: 'ease-out', fill: 'both'
        });
    }
}

// Đóng lá thư quay về orbit: lùi cú zoom lại thay vì bật cảnh về ngay.
// `instant` dùng khi đóng/reset hẳn orbit — không cần diễn.
function resetOrbitZoom(instant = false) {
    const zoom = orbitZoomAnimation;
    const veil = orbitVeilAnimation;
    const stageEl = document.getElementById('orbit-stage');
    const release = () => { if (stageEl) stageEl.style.willChange = ''; };
    orbitZoomAnimation = null;
    orbitVeilAnimation = null;
    const heartAnim = heartBeatAnimation;
    if (!zoom) {
        veil?.cancel();
        release();
        return;
    }
    if (instant || orbitReduced()) {
        zoom.cancel();
        veil?.cancel();
        release();
        return;
    }
    // reverse() chạy ngược từ đúng vị trí hiện tại, kể cả khi animation đã
    // "finished" và đang giữ khung cuối nhờ fill.
    const rewind = (anim, rate) => {
        anim.updatePlaybackRate(rate);
        anim.reverse();
    };
    rewind(zoom, 1.6);
    zoom.onfinish = () => { zoom.cancel(); release(); };
    if (veil) {
        rewind(veil, 1.6);
        veil.onfinish = () => veil.cancel();
    }
    // Trái tim chính đã mờ trong lúc cao trào; hiện lại cùng lúc với cú lùi.
    if (heartAnim && heartAnim === heartBeatAnimation) {
        rewind(heartAnim, 2.4);
        heartAnim.onfinish = () => {
            heartAnim.cancel();
            if (heartBeatAnimation === heartAnim) heartBeatAnimation = null;
        };
    }
}

// Cỡ hiện tại của phần tử (đọc TRƯỚC khi huỷ animation đang giữ nó). Nhịp mới
// phải bắt đầu từ đúng cỡ này — bắt đầu từ một số cố định như scale(0.96) là
// tim co giật một phát mỗi lần chạm, vì nhịp trước để nó ở ~1.02–1.04.
function currentScale(el) {
    const m = getComputedStyle(el).transform;
    if (!m || m === 'none') return 1;
    const v = m.match(/matrix\(([^,]+),\s*([^,]+)/);
    return v ? Math.hypot(parseFloat(v[1]), parseFloat(v[2])) : 1;
}

function playChargedHeartbeat() {
    const wrapper = document.getElementById('heart-charge');
    const from = currentScale(wrapper);
    heartBeatAnimation?.cancel();
    if (orbitReduced()) {
        heartBeatAnimation = wrapper.animate([{ opacity: 0.8 }, { opacity: 1 }], { duration: 120 });
        return;
    }
    const peak = 1.16 + heartCharge * 0.09;
    const rest = 1 + heartCharge * 0.018;
    heartBeatAnimation = wrapper.animate([
        { transform: `scale(${from.toFixed(3)})` }, { transform: `scale(${peak})` },
        { transform: `scale(${heartCharge >= 6 ? 1 : rest})` },
        { transform: `scale(${heartCharge >= 6 ? peak : rest})` },
        { transform: `scale(${rest})` }
    ], { duration: 420, easing: 'ease-out', fill: 'forwards' });
    heartSlowStart = performance.now();
    spawnHeartEffects();
    // Mỗi nhịp chạm là một cú phun dày, quạt rộng và bay xa hơn vòi phun nền.
    const tapCounts = orbitDeviceTier().lite ? [0, 6, 9] : [0, 10, 16];
    spawnFountainHearts(tapCounts[heartCharge] || tapCounts[tapCounts.length - 1], {
        spread: 70,
        reach: [0.8, 1.35],
        duration: [1900, 2600],
        jitter: 140,
        scale: 1.15
    });
}

// Timeline cao trào (HEART_BURST_MS = 2700):
//   0–900ms     tim bay ra xếp thành vành trái tim, chòm sao chạy sáng một vòng
//   900–1560ms  vành tim nhún tại chỗ, trái tim chính mờ dần
//   1560–2400   ZOOM thẳng vào trái tim, vành tim bay tản ra mép
//   2400–2700   lớp phủ màu tim hiện lên → mở lá thư
function completeHeartCharge() {
    isHeartBursting = true;
    stopHeartAmbient(false);
    brakeOrbit(650);
    const wrapper = document.getElementById('heart-charge');
    const from = currentScale(wrapper);
    heartBeatAnimation?.cancel();
    const stage = document.getElementById('orbit-stage');
    stage.classList.add('is-heart-bursting');
    if (!orbitReduced()) {
        spawnHeartEffects(true);
        runOrbitConstellationChase();
        // Tim chính nảy một nhịp mạnh rồi lùi mờ vào giữa vành tim — vành
        // tim mới là nhân vật chính của cao trào này.
        heartBeatAnimation = wrapper.animate([
            { transform: `scale(${from.toFixed(3)})`, opacity: 1 },
            { transform: 'scale(1.18)', opacity: 1, offset: 0.1 },
            { transform: 'scale(1)', opacity: 0.9, offset: 0.33 },
            { transform: 'scale(0.94)', opacity: 0.28, offset: 0.58 },
            { transform: 'scale(1.05)', opacity: 0.2 }
        ], { duration: HEART_BURST_MS, easing: 'ease-in-out', fill: 'forwards' });
        playOrbitZoom(Math.round(HEART_BURST_MS * 0.58), Math.round(HEART_BURST_MS * 0.31));
    }
    heartBurstTimer = setTimeout(() => {
        if (!orbitOpen || !isHeartBursting) return;
        isFinalLetterUnlocked = true;
        isHeartBursting = false;
        heartBurstTimer = null;
        // KHÔNG huỷ heartBeatAnimation/zoom ở đây: lá thư mở đè lên đúng khung
        // cảnh đã zoom. closeFullLetter() → resetOrbitZoom() mới lùi chúng lại;
        // huỷ ngay bây giờ thì trái tim bật sáng trở lại sau lớp thư đang hiện.
        stage.classList.remove('is-heart-bursting');
        updateHeartCharge();
        openFullLetter();
    }, orbitReduced() ? 180 : HEART_BURST_MS);
}

function handleHeartTap(event) {
    event.stopPropagation();
    if (!orbitOpen || isHeartBursting || orbitCardIndex >= 0) return;
    if (orbitArrival && !orbitArrival.heartReady) return;
    if (isFinalLetterUnlocked) { openFullLetter(); return; }
    const now = performance.now();
    if (now - lastHeartTapTime < 120) return;
    lastHeartTapTime = now;
    heartCharge = Math.min(HEART_TAP_TARGET, heartCharge + 1);
    updateHeartCharge();
    if (heartCharge === HEART_TAP_TARGET) completeHeartCharge();
    else {
        playChargedHeartbeat();
        startHeartAmbient();
    }
}

// ---- NHIỄU CÓ SEED ----
// Port nguyên từ rand.ts. Cùng index + salt luôn ra cùng một số, nên bầu trời
// giống hệt nhau ở mọi lần mở — dùng Math.random() thì mỗi lần đóng/mở lại là
// một bầu trời khác, và người xem nhận ra ngay là đồ giả.
function orbitRand(index, salt = 1) {
    const value = 43758.5453 * Math.sin((index + 1) * 12.9898 * salt);
    return value - Math.floor(value);
}

function orbitRound(value, digits = 2) {
    return Number(value.toFixed(digits));
}

// ---- PHÂN HẠNG MÁY ----
// Port readTier(). `lite` bỏ hết blur và làm thưa mọi lớp sinh tự động; `rich`
// là đầu kia, nơi quầng sáng sau trái tim đủ sức gánh thêm một lớp blur.
// Máy không đổi giữa chừng nên đo một lần rồi nhớ luôn.
function orbitDeviceTier() {
    if (orbitTier) return orbitTier;

    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory;
    const lite = cores <= 4 || (typeof memory === 'number' && memory <= 4);

    orbitTier = { lite, rich: !lite && cores >= 8 };
    return orbitTier;
}

function orbitReduced() {
    return typeof prefersReducedMotion === 'function' && prefersReducedMotion();
}

// ---- CÁC LỚP BẦU TRỜI ----
// Tinh vân đào–tím, hai lớp sao parallax, hạt sáng bay lên, sao băng. Dựng bằng chuỗi HTML một lần rồi thôi — chúng không bao giờ đổi sau khi
// dựng, nên không cần giữ tham chiếu tới từng phần tử.

function buildOrbitNebulae(reduce, lite) {
    const clouds = [
        { color: 'rgba(201,138,130,0.30)', w: '70vw', left: '8%', top: '12%', anim: 'ol-nebula-a 26s ease-in-out infinite' },
        { color: 'rgba(200,184,217,0.24)', w: '62vw', left: '52%', top: '30%', anim: 'ol-nebula-b 32s ease-in-out infinite' },
        { color: 'rgba(217,197,163,0.22)', w: '58vw', left: '26%', top: '58%', anim: 'ol-nebula-a 38s ease-in-out infinite' }
    ];

    return clouds.map(cloud => `
        <div class="ol-nebula" style="
            left:${cloud.left}; top:${cloud.top};
            width:${cloud.w}; height:${cloud.w};
            background: radial-gradient(circle, ${cloud.color} 0%, transparent 68%);
            filter:${lite ? 'none' : 'blur(18px)'};
            animation:${reduce || lite ? 'none' : cloud.anim};"></div>
    `).join('');
}

function buildOrbitStarLayer(count, salt, anim, reduce, lite) {
    const palette = [
        { c: 'var(--ol-ivory)', g: 'rgba(255,248,234,' },
        { c: 'var(--ol-champagne)', g: 'rgba(232,201,178,' },
        { c: 'rgba(200,184,217,0.95)', g: 'rgba(200,184,217,' }
    ];

    let html = '';
    for (let i = 0; i < count; i++) {
        const hue = orbitRand(i, salt + 7);
        const tone = hue < 0.62 ? palette[0] : hue < 0.84 ? palette[1] : palette[2];
        const big = orbitRand(i, salt + 8) > 0.85;
        const glow = big ? orbitRound(7 + 5 * orbitRand(i, salt + 9)) : 5;
        const size = orbitRound((big ? 1.6 : 0.8) + 1.9 * orbitRand(i, salt + 2));
        const dur = orbitRound(3 + 5 * orbitRand(i, salt + 3));
        const delay = orbitRound(5 * orbitRand(i, salt + 4));
        const min = orbitRound(0.1 + 0.2 * orbitRand(i, salt + 5), 3);
        const max = orbitRound((big ? 0.7 : 0.55) + 0.4 * orbitRand(i, salt + 6), 3);

        html += `<span class="ol-star" style="
            left:${orbitRound(100 * orbitRand(i, salt), 3)}%;
            top:${orbitRound(100 * orbitRand(i, salt + 1), 3)}%;
            width:${size}px; height:${size}px;
            background:${tone.c};
            box-shadow:0 0 ${glow}px ${tone.g}${big ? '0.85' : '0.7'});
            animation:${reduce || lite ? 'none' : `ol-twinkle ${dur}s ease-in-out ${delay}s infinite`};
            --star-min:${min}; --star-max:${max};"></span>`;
    }

    return `<div class="ol-starlayer" style="animation:${reduce || lite ? 'none' : anim};">${html}</div>`;
}

// Hạt sáng bay lên (champagne + hồng phấn) — tiếp nối lớp sparkles của màn 1.
function buildOrbitSparkles(reduce, lite) {
    let html = '';
    for (let i = 0; i < (lite ? 16 : 32); i++) {
        const dur = orbitRound(9 + 10 * orbitRand(i, 251));
        const pink = orbitRand(i, 263) < 0.55;
        html += `<span class="ol-spark" style="
            left:${orbitRound(100 * orbitRand(i, 257), 3)}%;
            ${reduce ? `top:${orbitRound(100 * orbitRand(i, 269), 2)}%;` : ''}
            background:${pink ? '#ffd0dc' : '#ffeacc'};
            box-shadow:0 0 6px ${pink ? 'rgba(255,170,190,0.8)' : 'rgba(255,220,168,0.8)'};
            animation:${reduce ? 'none' : `ol-spark-rise ${dur}s linear ${orbitRound(-dur * orbitRand(i, 271))}s infinite`};
            --spark-max:${orbitRound(0.35 + 0.5 * orbitRand(i, 277), 3)};"></span>`;
    }
    return `<div class="ol-layer ol-clip">${html}</div>`;
}

// Cánh hoa hồng bay chéo — lấy chất liệu từ chính tranh tim hoa ở giữa để nền
// và trái tim là một bộ. Ba lớp lồng nhau tách ba chuyển động: rơi (ngoài),
// lắc ngang (giữa), lật xoay 3D (trong), mỗi lớp một nhịp nên không lặp đều.
function buildOrbitPetals(reduce, lite) {
    const tones = [
        ['#ffe3ec', '#f7a8c4'],
        ['#ffd0de', '#ee66a6'],
        ['#fff1f4', '#f5b8c8'],
        ['#ffc2d4', '#e0507f']
    ];
    let html = '';

    for (let i = 0; i < (lite ? 9 : 18); i++) {
        const depth = orbitRand(i, 311);
        const [light, deep] = tones[Math.floor(orbitRand(i, 313) * tones.length)];
        const size = orbitRound(13 + 12 * depth);
        const fall = orbitRound(14 + 12 * (1 - depth));
        const sway = orbitRound(3 + 3 * orbitRand(i, 317));
        const spin = orbitRound(4 + 5 * orbitRand(i, 331));
        const top = reduce ? `top:${orbitRound(100 * orbitRand(i, 337), 2)}%;` : '';

        html += `<span class="ol-petal" style="
            left:${orbitRound(-10 + 100 * orbitRand(i, 347), 2)}%; ${top}
            opacity:${orbitRound(0.45 + 0.45 * depth, 3)};
            filter:${lite || depth > 0.45 ? 'none' : `blur(${orbitRound(1.4 * (1 - depth / 0.45), 2)}px)`};
            animation:${reduce ? 'none' : `ol-petal-fall ${fall}s linear ${orbitRound(-fall * orbitRand(i, 349))}s infinite`};
            --petal-drift:${Math.round(12 + 18 * orbitRand(i, 353))}vw;">
            <span class="ol-petal-sway" style="animation:${reduce ? 'none' : `ol-petal-sway ${sway}s ease-in-out ${orbitRound(-sway * orbitRand(i, 359))}s infinite alternate`};">
                <span class="ol-petal-leaf" style="
                    width:${size}px; height:${orbitRound(size * 0.82)}px;
                    background:radial-gradient(120% 120% at 20% 20%, ${light} 0%, ${deep} 100%);
                    animation:${reduce ? 'none' : `ol-petal-spin ${spin}s linear ${orbitRound(-spin * orbitRand(i, 367))}s infinite`};
                    transform:rotate(${Math.round(360 * orbitRand(i, 373))}deg);"></span>
            </span>
        </span>`;
    }

    return `<div class="ol-layer ol-clip">${html}</div>`;
}

// Bướm: cánh trên + cánh dưới có vân, chấm trắng viền mép, thân và râu. Mỗi
// nửa cánh là một lớp riêng vỗ bằng rotateY trong không gian 3D nên trông như
// cánh gập thật chứ không bóp dẹt. Ba con lượn vòng quanh mép màn hình suốt
// (không bao giờ ra khỏi khung), chừa vùng giữa cho trái tim.
function buildOrbitButterflies(reduce, lite) {
    const wingSvg = `
        <svg viewBox="0 0 50 62" aria-hidden="true">
            <path d="M50 27 C41 7 20 -1 7 5 C-2 10 2 25 13 30 C25 35 40 33 50 31 Z"
                  fill="url(#ol-bfly-upper)" stroke="#a8345f" stroke-width="1.1"/>
            <path d="M50 32 C38 33 22 39 18 49 C15 58 26 62 34 55 C42 49 47 41 50 35 Z"
                  fill="url(#ol-bfly-lower)" stroke="#a8345f" stroke-width="1.1"/>
            <g fill="none" stroke="rgba(130,30,70,0.38)" stroke-width="0.7" stroke-linecap="round">
                <path d="M49 28 C38 18 24 10 10 8"/><path d="M49 29 C36 24 22 22 9 20"/>
                <path d="M49 30 C38 30 26 30 15 29"/><path d="M49 34 C40 38 30 44 23 52"/>
                <path d="M49 35 C44 42 38 49 32 55"/>
            </g>
            <ellipse cx="22" cy="15" rx="5.5" ry="4" fill="rgba(255,255,255,0.55)"/>
            <g fill="#fff8f2">
                <circle cx="9" cy="9" r="1.4"/><circle cx="5.5" cy="15" r="1.2"/>
                <circle cx="7" cy="22" r="1.2"/><circle cx="20" cy="54" r="1.1"/>
                <circle cx="27" cy="58" r="1.1"/>
            </g>
        </svg>`;

    const butterfly = `
        <span class="ol-bfly-body">
            <span class="ol-bfly-wing is-left">${wingSvg}</span>
            <span class="ol-bfly-wing is-right">${wingSvg}</span>
            <svg class="ol-bfly-thorax" viewBox="0 0 20 62" aria-hidden="true">
                <path d="M10 14 C6 8 4 3 2 1 M10 14 C14 8 16 3 18 1" fill="none" stroke="#5a1f36" stroke-width="1" stroke-linecap="round"/>
                <circle cx="2" cy="1.5" r="1.5" fill="#5a1f36"/><circle cx="18" cy="1.5" r="1.5" fill="#5a1f36"/>
                <ellipse cx="10" cy="33" rx="2.6" ry="17" fill="#6b2541"/>
                <ellipse cx="10" cy="22" rx="3.2" ry="5" fill="#7d2d4d"/>
            </svg>
        </span>`;

    const flights = [
        { path: 'ol-bfly-path-a', dur: 24, delay: 0, size: 58, flap: 0.26 },
        { path: 'ol-bfly-path-b', dur: 28, delay: -9, size: 50, flap: 0.3 },
        { path: 'ol-bfly-path-c', dur: 32, delay: -17, size: 42, flap: 0.24 }
    ].slice(0, lite ? 2 : 3);

    const html = flights.map(f => `
        <span class="ol-bfly" style="
            width:${f.size}px; height:${Math.round(f.size * 0.62)}px;
            animation:${reduce ? 'none' : `${f.path} ${f.dur}s ease-in-out ${f.delay}s infinite`};
            --flap:${f.flap}s;">
            <span class="ol-bfly-bob" style="animation:${reduce ? 'none' : `ol-bfly-bob ${orbitRound(2.2 + f.flap * 3)}s ease-in-out infinite alternate`};">${butterfly}</span>
        </span>`).join('');

    return `<div class="ol-layer ol-clip${reduce ? ' is-still' : ''}">
        <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
            <radialGradient id="ol-bfly-upper" cx="100%" cy="50%" r="100%">
                <stop offset="0" stop-color="#fff3e8"/>
                <stop offset="0.35" stop-color="#ffc4d6"/>
                <stop offset="0.8" stop-color="#ef7fa6"/>
                <stop offset="1" stop-color="#c94f7e"/>
            </radialGradient>
            <radialGradient id="ol-bfly-lower" cx="100%" cy="20%" r="100%">
                <stop offset="0" stop-color="#fff0e4"/>
                <stop offset="0.45" stop-color="#ffb8cc"/>
                <stop offset="1" stop-color="#d9628f"/>
            </radialGradient>
        </defs></svg>
        ${html}
    </div>`;
}

function buildOrbitShootingStars(reduce, lite) {
    if (reduce) return '';

    const all = [
        { top: '16%', left: '-6%', x: 460, y: 150, rot: 18, dur: 7, delay: 2 },
        { top: '44%', left: '-8%', x: 520, y: 90, rot: 10, dur: 9, delay: 6 },
        { top: '8%', left: '30%', x: 360, y: 220, rot: 32, dur: 11, delay: 9.5 }
    ];

    const streaks = all.slice(0, lite ? 1 : 2);
    const html = streaks.map(s => `
        <span class="ol-shoot" style="
            top:${s.top}; left:${s.left};
            animation: ol-shoot ${s.dur}s ease-in ${s.delay}s infinite;
            --shoot-x:${s.x}px; --shoot-y:${s.y}px; --shoot-rot:${s.rot}deg;"></span>
    `).join('');

    return `<div class="ol-layer ol-clip">${html}</div>`;
}

// ---- CHÒM SAO TRÁI TIM Ở MÀN 2 ----
// Cùng dữ liệu HEART_CONSTELLATION với chòm sao màn 1 (script.js): trái tim
// sao người xem vừa ghép xong "đi theo" sang màn này, nằm mờ sau trái tim chính.
// viewBox giữ đúng tỉ lệ 420×392 của ảnh mẫu (+ lề 30 cho tia sáng của sao),
// nên không phải kéo giãn và nét không bị méo.
function buildOrbitConstellation(lite) {
    const pts = HEART_CONSTELLATION.map(([x, y]) => [x * 4.2, y * 3.92]);
    const d = `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z`;
    const big = new Set([0, 5, 9]); // mũi tim + hai đỉnh thuỳ: đúng 3 sao ký ức ở màn 1
    const stars = pts.map(([x, y], i) => {
        const r = big.has(i) ? 7 : 4.6;
        const g = big.has(i) ? 17 : 10;
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
            <g class="ol-cstar" style="--i:${i}; --tw:${((i * 0.41) % 2.4).toFixed(2)}s">
                <path d="M0 ${-r} L${r * 0.2} ${-r * 0.2} L${r} 0 L${r * 0.2} ${r * 0.2} L0 ${r} L${-r * 0.2} ${r * 0.2} L${-r} 0 L${-r * 0.2} ${-r * 0.2}Z"/>
                <line x1="${-g}" y1="0" x2="${g}" y2="0"/><line x1="0" y1="${-g}" x2="0" y2="${g}"/>
            </g></g>`;
    }).join('');
    return `<svg class="ol-constellation" viewBox="-30 -30 480 452" aria-hidden="true">
        <path class="ol-const-base" d="${d}"/>
        <path class="ol-const-draw" d="${d}" pathLength="100"/>
        ${lite ? '' : `<path class="ol-const-comet" d="${d}" pathLength="100"/>`}
        ${stars}
    </svg>`;
}

// Viền tim trơn mảnh ôm sát trái tim chính — chỉ một cung sáng trượt quanh,
// không phải vòng khép kín (giây 6 của video).
function buildOrbitHeartOutline() {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
        const [x, y] = heartCurveNormalized((Math.PI * 2 * i) / 80);
        pts.push(`${i ? 'L' : 'M'}${x.toFixed(2)} ${(y * 0.9).toFixed(2)}`);
    }
    return `<svg class="ol-heart-outline" viewBox="-2 -2 104 94" aria-hidden="true">
        <path d="${pts.join(' ')}Z" pathLength="100"/>
    </svg>`;
}

// Vòng quỹ đạo nghiêng có hạt chấm, chia hai nửa: nửa trên nằm SAU trái tim,
// nửa dưới nằm TRƯỚC — vòng như xuyên qua tim. Hệ đơn vị 1 = 1% bề rộng tim,
// cùng HEART_RING mà layoutSatellites() dùng, nên tim vệ tinh chạy đúng trên nét.
function buildOrbitRingHalf(half) {
    const { rx, ry, cy, tilt } = HEART_RING;
    const d = half === 'back'
        ? `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0`
        : `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${-rx} 0`;
    return `<svg class="ol-orbit ol-orbit-${half}" viewBox="-90 -90 180 180" aria-hidden="true">
        <g transform="translate(0 ${cy}) rotate(${tilt})">
            <path class="ol-orbit-arc" d="${d}" pathLength="100"/>
            <path class="ol-orbit-beads" d="${d}"/>
        </g>
    </svg>`;
}

// Vệt sáng chạy trọn chòm sao màn 2 một vòng — mở đầu cao trào.
function runOrbitConstellationChase() {
    const svg = document.querySelector('.ol-constellation');
    if (!svg) return;
    svg.classList.remove('is-chasing');
    void svg.getBoundingClientRect();
    svg.classList.add('is-chasing');
    setTimeout(() => svg.classList.remove('is-chasing'), 1600);
}

// Trao tay từ màn 1: chòm sao màn 1 vừa bay tới đúng chỗ này, nên chòm sao
// màn 2 bật sáng 100% ngay (không vẽ lại) rồi dịu dần về mức nghỉ.
function arriveOrbitConstellation() {
    const svg = document.querySelector('.ol-constellation');
    if (!svg) return;
    svg.classList.remove('is-drawn');
    void svg.getBoundingClientRect();
    svg.classList.add('is-arrived');
}

// Mỗi lần mở orbit, chòm sao VẼ LẠI từ mũi tim — nối tiếp đúng khoảnh khắc
// chòm sao màn 1 vừa khép vòng.
function replayOrbitConstellation() {
    const svg = document.querySelector('.ol-constellation');
    if (!svg) return;
    svg.classList.remove('is-drawn', 'is-arrived');
    void svg.getBoundingClientRect();
    svg.classList.add('is-drawn');
}

// ---- DỰNG SÂN KHẤU ----
// Chip dưới mỗi token: khi LoveGift có lời nhắn thì hiện luôn lời nhắn (rút gọn)
// thay cho "Ký ức 1, 2...". Cắt ở ranh giới từ để không đứt giữa chữ tiếng Việt;
// CSS vẫn giữ line-clamp làm lưới an toàn cho màn hẹp.
const ORBIT_CHIP_MAX_CHARS = 26;
function orbitChipLabel(part, i) {
    const messages = window.LOVEGIFT_CONFIG && window.LOVEGIFT_CONFIG.messages;
    const text = String(part.text || '').replace(/\s+/g, ' ').trim();
    if (!Array.isArray(messages) || messages.length === 0 || !text) {
        return part.label || `Ký ức ${i + 1}`;
    }
    const chars = Array.from(text);
    if (chars.length <= ORBIT_CHIP_MAX_CHARS) return text;
    const cut = chars.slice(0, ORBIT_CHIP_MAX_CHARS).join('');
    const lastSpace = cut.lastIndexOf(' ');
    const head = lastSpace > ORBIT_CHIP_MAX_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut;
    return `${head.replace(/[\s,.;:!?-]+$/, '')}…`;
}

function buildOrbitScene() {
    if (orbitBuilt) return;

    const overlay = document.getElementById('memory-orbit');
    if (!overlay) return;

    const { lite, rich } = orbitDeviceTier();
    const reduce = orbitReduced();

    // Token: mỗi lời nhắn một tấm ảnh. Ảnh hỏng thì ẩn <img>, để lại khung sáng
    // có chữ cái đầu của nhãn — tốt hơn một ô xám trống đang bay vòng quanh.
    const tokensHtml = orbitMemories.map((part, i) => {
        const photo = safePhotoUrl(part.photo);
        const label = escapeHtml(orbitChipLabel(part, i));
        const dayClass = part.daylight ? ' is-daylight' : '';
        const fallbackPhoto = pickFallbackPhoto(photo || '');
        const img = photo
            ? `<img src="${escapeHtml(photo)}" alt="" class="${dayClass.trim()}" onerror="this.onerror=null; this.src='${escapeHtml(fallbackPhoto)}'">`
            : `<img src="${escapeHtml(fallbackPhoto)}" alt="" class="${dayClass.trim()}">`;

        return `<button type="button" class="ol-token" data-index="${i}"
                        aria-label="Đọc lại ký ức: ${label}">
                    <span class="ol-token-thumb"><span class="ol-token-fallback">${label.slice(0, 1)}</span>${img}</span>
                    <span class="ol-token-label">${label}</span>
                </button>`;
    }).join('');

    // Mỗi token một đường nối mảnh về tâm — giữ cảm giác "chòm sao" của màn
    // trước, để hai màn nối vào nhau chứ không phải hai thứ rời rạc.
    const linesHtml = lite ? '' : orbitMemories.map(() =>
        `<line class="ol-line" stroke="var(--ol-constellation)" stroke-width="1" stroke-linecap="round" style="opacity:0"></line>`
    ).join('');

    overlay.innerHTML = `
        <div class="ol-sky">
            ${buildOrbitNebulae(reduce, lite)}
            ${buildOrbitStarLayer(lite ? 9 : 26, 3, 'ol-star-pan-1 90s linear infinite alternate', reduce, lite)}
            ${buildOrbitStarLayer(lite ? 7 : 16, 31, 'ol-star-pan-2 130s linear infinite alternate', reduce, lite)}

            ${buildOrbitSparkles(reduce, lite)}
            ${buildOrbitPetals(reduce, lite)}
            ${buildOrbitButterflies(reduce, lite)}
            ${buildOrbitShootingStars(reduce, lite)}

            <div class="ol-halo" style="animation:${reduce || lite ? 'none' : 'ol-breathe 7.2s ease-in-out infinite'};"></div>
            <div class="ol-haze"></div>
            <div class="ol-vignette"></div>
        </div>

        <div class="ol-stage" id="orbit-stage">
            <div class="ol-ellipse-glow"></div>
            <img class="ol-ring" src="./assets/orbit/orbit-ring-cosmic-soft-01.svg" alt="" aria-hidden="true">
            <svg class="ol-lines" id="orbit-lines" aria-hidden="true">${linesHtml}</svg>

            <div class="ol-core">
                <div class="ol-core-float" style="animation:${reduce || lite ? 'none' : 'ol-core-float 7s ease-in-out infinite'};">
                    <span class="ol-heart-aura" aria-hidden="true" style="
                        filter:${rich && !reduce ? 'blur(8px)' : 'none'};
                        animation:${reduce || lite ? 'none' : 'ol-heart-glow 3.6s ease-in-out infinite'};"></span>
                    ${buildOrbitConstellation(lite)}
                    ${buildOrbitHeartOutline()}
                    ${buildOrbitRingHalf('back')}
                    <div class="ol-fountain" id="heart-fountain" aria-hidden="true"></div>
                    <div class="ol-heart-charge" id="heart-charge">
                    <button type="button" class="ol-heart-btn" id="orbit-heart"
                            aria-label="Mở lá thư">
                        <img class="ol-heart" src="./assets/orbit/traitimnew.svg" alt="">
                    </button>
                    </div>
                    ${buildOrbitRingHalf('front')}
                    <div class="ol-satellites" id="heart-satellites" aria-hidden="true"></div>
                    <!-- Lớp riêng cho tim/hạt sáng bay ra. TÁCH khỏi #heart-charge
                         chủ đích: #heart-charge tự phóng to rồi mờ dần khi cao
                         trào chạy (xem completeHeartCharge trong orbit.js), nên
                         hiệu ứng nào làm con của nó cũng bị kéo mờ theo cha —
                         đúng lúc tim bay ra đẹp nhất thì cha đã gần tắt. Đặt
                         ngang hàng để hiệu ứng giữ nguyên độ sáng của chính nó. -->
                    <div class="ol-heart-burst" id="heart-burst" aria-hidden="true"></div>
                </div>
            </div>

            <div class="ol-heart-progress" id="heart-progress-wrap" role="progressbar"
                 aria-label="Tiến trình mở lá thư" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0">
                <div class="ol-heart-progress-track"><span id="heart-progress-fill"></span></div>
                <span id="heart-progress-label">0/3 nhịp tim</span>
                <span class="ol-heart-hint" id="heart-progress-hint">Chạm vào trái tim để mở lá thư</span>
            </div>

            <div class="ol-titles">
                <p class="ol-eyebrow">MỘT CHÚT THƯƠNG</p>
                <span class="ol-rule" aria-hidden="true"><i></i><b></b><i></i></span>
                <h2 class="ol-title">Gửi ${escapeHtml(recipientName)}</h2>
            </div>

            ${tokensHtml}
        </div>

        <div class="ol-zoom-veil" id="orbit-zoom-veil" aria-hidden="true"></div>
        <button type="button" class="ol-close" id="orbit-close" aria-label="Quay lại cơn mưa lời yêu">&times;</button>

        <div class="ol-overlay" id="orbit-card" aria-hidden="true" role="dialog" aria-modal="true">
            <div class="ol-scrim"></div>
            <div class="ol-card" id="orbit-card-body"></div>
        </div>
    `;

    const stage = overlay.querySelector('#orbit-stage');
    const heartCharge = overlay.querySelector('#heart-charge');
    const fountain = overlay.querySelector('#heart-fountain');
    if (fountain) buildHeartPool(fountain, lite ? HEART_POOL_SIZE.lite : HEART_POOL_SIZE.regular);
    // Vệ tinh là con TRỰC TIẾP của .ol-core-float (không nằm trong một lớp
    // bọc có z-index), để z-index 3/7 của từng chiếc xen được vào giữa vòng
    // quỹ đạo sau (3), trái tim (5) và vòng quỹ đạo trước (6).
    const satelliteHost = overlay.querySelector('#heart-satellites');
    if (satelliteHost) {
        const coreFloat = satelliteHost.parentElement;
        buildSatellites(coreFloat, lite ? 2 : 3);
        satelliteHost.remove();
    }
    orbitTokens = Array.from(overlay.querySelectorAll('.ol-token'));
    orbitLines = Array.from(overlay.querySelectorAll('.ol-line'));

    orbitTokens.forEach(token => {
        token.addEventListener('click', event => {
            event.stopPropagation();
            openOrbitCard(Number(token.dataset.index));
        });
    });

    const heart = overlay.querySelector('#orbit-heart');
    if (heart) {
        // Native button click covers mouse, touch, Enter and Space exactly once.
        heart.addEventListener('click', handleHeartTap);
    }

    const close = overlay.querySelector('#orbit-close');
    if (close) {
        close.addEventListener('click', event => {
            event.stopPropagation();
            closeMemoryOrbit();
        });
    }

    const card = overlay.querySelector('#orbit-card');
    if (card) {
        card.addEventListener('click', event => {
            if (event.target === card || event.target.classList.contains('ol-scrim')) {
                closeOrbitCard();
            }
        });
    }

    // Toàn bộ toạ độ quỹ đạo tính từ kích thước sân khấu, nên phải ĐO chứ không
    // đoán. ResizeObserver bắt được cả trường hợp thanh địa chỉ mobile co lại,
    // thứ mà sự kiện resize của window bỏ sót.
    if (typeof ResizeObserver !== 'undefined' && stage) {
        orbitResizeObserver = new ResizeObserver(() => {
            orbitStageSize = { w: stage.clientWidth, h: stage.clientHeight };
            if (heartCharge) orbitHeartW = heartCharge.offsetWidth || orbitHeartW;
            layoutOrbit();
        });
        orbitResizeObserver.observe(stage);
    }

    orbitBuilt = true;
}

// ---- TOÁN QUỸ ĐẠO ----
// Port hàm layout() của bản gốc, giữ nguyên mọi hằng số.
//
// Mọi giá trị dưới đây ghi THẲNG vào element.style trong vòng rAF. Bản gốc ghi
// rõ lý do và đây là chỗ dễ làm sai nhất khi port: cho các giá trị này đi qua
// một vòng render hay để token mang transition thì mỗi frame lại mở một
// transition mới, và cảnh giật liên tục.
function layoutOrbit() {
    const count = orbitTokens.length;
    if (count === 0 || orbitStageSize.w === 0) return;

    const cx = orbitStageSize.w / 2;
    const cy = 0.46 * orbitStageSize.h;
    const compact = orbitStageSize.w <= 768 && orbitStageSize.h > orbitStageSize.w;
    // Chừa chỗ cho chip hai dòng ở mép màn hình. Ellipse cao hơn trên
    // điện thoại để chip phía trước không đè lên ảnh kế bên.
    const rx = Math.min(0.44 * orbitStageSize.w, 360, orbitStageSize.w / 2 - 54);
    const ry = compact ? Math.min(orbitStageSize.h * 0.25, rx * 1.35) : 0.62 * rx;
    // Nhiều ảnh (người gửi tải lên hơn 8 tấm) thì thu nhỏ token để khỏi đè
    // nhau, và rút ngắn độ trễ để tấm cuối vẫn bay ra kịp trong cảnh đến.
    const crowd = count > 8 ? Math.max(0.55, Math.sqrt(8 / count)) : 1;
    const stagger = count > 1 ? Math.min(ARRIVAL.tokenStagger, 450 / (count - 1)) : 0;

    for (let i = 0; i < count; i++) {
        const token = orbitTokens[i];
        if (!token) continue;

        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2 + orbitRotation;
        // Lúc màn 2 vừa "đến", từng tấm ảnh bay từ TÂM trái tim ra đúng chỗ
        // của nó trên quỹ đạo (vọt quá một chút rồi về). Hết cảnh đến thì
        // e = 1 và mọi thứ như cũ.
        const e = arrivalProgress(ARRIVAL.tokenStart + i * stagger, ARRIVAL.tokenDur);
        const k = e >= 1 ? 1 : easeOutBack(e);
        const x = Math.cos(angle) * rx * k;
        const y = Math.sin(angle) * ry * k;
        if (orbitArrival) token.classList.toggle('is-ready', e >= 1);

        // 0 ở nửa xa của ellipse, 1 ở nửa gần. Một con số này kéo theo cả tỉ lệ,
        // độ mờ, độ nhoè và z-index — nhờ vậy ảnh ở nửa xa thật sự đi vòng ra
        // SAU trái tim chứ không phải chỉ nhỏ đi.
        const depth = (Math.sin(angle) + 1) / 2;
        const scale = compact ? 0.42 + 0.46 * depth
            : orbitStageSize.h <= 500 ? 0.48 + 0.62 * depth : 0.52 + 0.78 * depth;
        const blur = orbitRound((1 - depth) * 2.6, 1);

        token.style.transform =
            `translate(-50%, -50%) translate(${orbitRound(cx + x, 1)}px, ${orbitRound(cy + y, 1)}px) scale(${orbitRound(crowd * scale * (0.3 + 0.7 * e), 3)})`;
        token.style.zIndex = String(Math.round(80 * depth));
        token.style.opacity = String(orbitRound((0.4 + 0.6 * depth) * e, 3));
        token.style.filter = blur > 0.15 ? `blur(${blur}px)` : 'none';

        const line = orbitLines[i];
        if (line) {
            line.setAttribute('x1', String(orbitRound(cx, 1)));
            line.setAttribute('y1', String(orbitRound(cy, 1)));
            line.setAttribute('x2', String(orbitRound(cx + x, 1)));
            line.setAttribute('y2', String(orbitRound(cy + y, 1)));
            line.style.opacity = String(orbitRound((0.05 + 0.18 * depth) * e, 3));
        }
    }

    // Vệ tinh quay nhanh hơn ảnh 2,4 lần; giảm chuyển động thì đứng yên.
    layoutSatellites(orbitReduced() ? 0 : orbitRotation * 2.4);
}

function tickOrbit(now) {
    if (orbitPrevTime == null) orbitPrevTime = now;
    const dt = (now - orbitPrevTime) / 1000;
    orbitPrevTime = now;

    const reduce = orbitReduced();
    const { lite } = orbitDeviceTier();
    const speed = (2 * Math.PI) / (reduce ? ORBIT_PERIOD_REDUCED_S : ORBIT_PERIOD_S);
    const surge = lite || reduce ? 1 : ORBIT_SURGE_FACTOR;

    // Cứ 11s quỹ đạo lại lướt nhanh một nhịp rồi chậm lại, vào/ra theo đường
    // smoothstep. Đây là chi tiết giữ cho vòng quay khỏi ra cảm giác máy móc.
    orbitClock += dt;
    const phase = orbitClock % ORBIT_SURGE_EVERY_S;
    const t = phase / ORBIT_SURGE_DUR_S;
    const burst = phase < ORBIT_SURGE_DUR_S
        ? 1 + (surge - 1) * Math.sin(t * t * (3 - 2 * t) * Math.PI)
        : 1;

    // Và lúc vừa mở thì quay nhanh rồi lắng dần sau 2.2s, để cảnh "khởi động"
    // chứ không đứng sẵn ở tốc độ đều.
    orbitElapsed += dt;
    const spinUp = Math.min(1, orbitElapsed / ORBIT_SPINUP_S);
    const boost = reduce ? 1 : 1 + (1 - spinUp) * 1.6;

    orbitRotation += dt * speed * burst * boost * orbitSpeedFactor(now);
    layoutOrbit();
    if (orbitBrake && now - orbitBrake.start >= orbitBrake.dur) {
        // Phanh xong: dừng hẳn vòng rAF để nhường GPU cho cao trào.
        orbitBrake = null;
        orbitFrame = 0;
        orbitPrevTime = null;
        return;
    }
    orbitFrame = requestAnimationFrame(tickOrbit);
}

// Hệ số tốc độ quỹ đạo, luôn liên tục theo thời gian (không có bậc thang):
//   · chạm tim: 1 → 0.3 trong 25% đầu, rồi 0.3 → 1 trong 75% còn lại, cả
//     hai đoạn theo smoothstep (đạo hàm = 0 ở hai đầu, không có cú giật)
//   · phanh ở nhịp 3: nhân thêm (1 − q)², trượt êm về 0
const smoothstep = x => x * x * (3 - 2 * x);

function orbitSpeedFactor(now) {
    let factor = 1;
    const p = (now - heartSlowStart) / HEART_SLOW_MS;
    if (p >= 0 && p < 1) {
        const dip = p < 0.25 ? smoothstep(p / 0.25) : 1 - smoothstep((p - 0.25) / 0.75);
        factor -= 0.7 * dip;
    }
    if (orbitBrake) {
        const q = Math.min(1, (now - orbitBrake.start) / orbitBrake.dur);
        factor *= (1 - q) * (1 - q);
    }
    return factor;
}

function brakeOrbit(ms) {
    if (!orbitFrame || orbitReduced()) {
        stopOrbitLoop();
        return;
    }
    orbitBrake = { start: performance.now(), dur: ms };
}

function startOrbitLoop() {
    if (orbitFrame || !orbitOpen || document.hidden || isHeartBursting || orbitCardIndex >= 0 || document.getElementById('full-letter').classList.contains('is-open')) return;
    orbitPrevTime = null;
    orbitFrame = requestAnimationFrame(tickOrbit);
}

function stopOrbitLoop() {
    orbitBrake = null;
    if (!orbitFrame) return;
    cancelAnimationFrame(orbitFrame);
    orbitFrame = 0;
    orbitPrevTime = null;
}

// ---- MỞ / ĐÓNG ----
// mode:
//   'arrive' — đi tiếp từ màn 1 (rain.js, startRainExit): chỉ trời ngân
//              hà hiện ra; chòm sao màn 1 vẫn đang bay tới. Trái tim chỉ nở
//              khi script.js gọi beginOrbitArrival() lúc trao tay.
//   'bloom'  — mở orbit không qua màn 1: tim nở + ảnh bay
//              ra ngay, chòm sao tự vẽ lại từ mũi tim.
//   'plain'  — giảm chuyển động: hiện ra một lượt như bản cũ.
function openMemoryOrbit(options = {}) {
    const overlay = document.getElementById('memory-orbit');
    if (!overlay || orbitOpen) return;
    const mode = orbitReduced() ? 'plain' : (options.mode || 'bloom');

    buildOrbitScene();

    orbitOpen = true;
    // Chặn raycast: một cú chạm lọt qua sẽ mở popup đè lên chính màn orbit.
    isPopupOpen = true;
    // Dừng vòng rAF của Three.js — trừ khi đang đi tiếp từ màn 1: lúc đó đèn
    // lồng còn phải trôi cho cú "bay lên trời", script.js tự dừng khi trao tay.
    if (mode !== 'arrive') isPlaying = false;

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('lantern-hover');

    const stage = overlay.querySelector('#orbit-stage');
    if (stage) {
        orbitStageSize = { w: stage.clientWidth, h: stage.clientHeight };
    }
    orbitHeartW = document.getElementById('heart-charge')?.offsetWidth || orbitHeartW;

    // Đặt vòng quay về mốc đầu để cú spin-up chạy lại mỗi lần mở.
    orbitElapsed = 0;
    orbitClock = 0;
    updateHeartCharge();

    if (mode === 'plain') {
        replayOrbitConstellation();
        layoutOrbit();
        if (heartCharge === HEART_TAP_TARGET && !isFinalLetterUnlocked) completeHeartCharge();
        if (!isHeartBursting) {
            startOrbitLoop();
            startHeartAmbient();
        }
        return;
    }

    orbitArrival = { t0: null, heartReady: false, anims: [], timer: null };
    overlay.classList.add('is-arriving');
    layoutOrbit();
    startOrbitLoop();
    if (mode === 'bloom') {
        replayOrbitConstellation();
        beginOrbitArrival();
    }
}

// ---- CẢNH "ĐẾN" CỦA MÀN 2 ----
// Mốc tính từ lúc trái tim bắt đầu nở (beginOrbitArrival). Tổng 1,5s.
const ARRIVAL = {
    tokenStart: 300, tokenStagger: 70, tokenDur: 750,  // ảnh bay từ tim ra quỹ đạo
    satStart: 450, satDur: 700,                        // tim vệ tinh hiện dần
    heartReady: 1250,                                  // từ đây chạm tim mới tính nhịp
    done: 1500
};
let orbitArrival = null;

// 0 → 1 cho một phần tử bắt đầu ở `delay`, kéo dài `dur` (ms). Ngoài cảnh đến
// luôn là 1; trong cảnh đến mà tim chưa nở thì là 0 (ảnh nằm gọn ở tâm, vô hình).
function arrivalProgress(delay, dur) {
    if (!orbitArrival) return 1;
    if (orbitArrival.t0 == null) return 0;
    return Math.min(1, Math.max(0, (performance.now() - orbitArrival.t0 - delay) / dur));
}

function easeOutBack(t) {
    const c1 = 1.25, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Trái tim nở ra từ tâm chòm sao: điểm sáng → tim phồng lên → hai vòng xung
// kích → vòng quỹ đạo tự vẽ → ảnh bay ra → chữ và gợi ý hiện cuối.
function beginOrbitArrival() {
    const overlay = document.getElementById('memory-orbit');
    if (!overlay || !orbitArrival || orbitArrival.t0 != null) return;
    orbitArrival.t0 = performance.now();
    // Cú spin-up 2,2s trùng đúng lúc ảnh bay ra.
    orbitElapsed = 0;
    overlay.classList.add('is-blooming');

    const heartBtn = document.getElementById('orbit-heart');
    const aura = overlay.querySelector('.ol-heart-aura');
    const track = anim => { orbitArrival.anims.push(anim); return anim; };

    if (heartBtn) {
        const r = heartBtn.getBoundingClientRect();
        if (typeof spawnConstellationFlash === 'function') {
            const flash = spawnConstellationFlash(r.left + r.width / 2, r.top + r.height * 0.5);
            flash.classList.add('is-small');
            setTimeout(() => flash.remove(), 900);
        }
        track(heartBtn.animate([
            { transform: 'scale(0.2)', opacity: 0 },
            { transform: 'scale(1.08)', opacity: 1, offset: 0.62 },
            { transform: 'scale(1)', opacity: 1 }
        ], { duration: 800, easing: 'cubic-bezier(.2, .9, .3, 1.1)', fill: 'both' }));
    }
    if (aura) {
        // WAAPI thắng animation inline ol-heart-glow trong lúc chạy, xong thì
        // animation cũ tự chạy tiếp.
        track(aura.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out', fill: 'both' }));
    }
    const ring = document.getElementById('heart-charge');
    if (ring) {
        [150, 350].forEach(delay => {
            const node = document.createElement('span');
            node.className = 'ol-heart-effect ol-heart-pulse-ring';
            node.style.animationDelay = `${delay}ms`;
            ring.appendChild(node);
            setTimeout(() => node.remove(), delay + 1000);
        });
    }

    orbitArrival.timer = setTimeout(() => {
        if (orbitArrival) orbitArrival.heartReady = true;
    }, ARRIVAL.heartReady);
    orbitArrival.doneTimer = setTimeout(completeOrbitArrival, ARRIVAL.done);
}

function completeOrbitArrival() {
    const overlay = document.getElementById('memory-orbit');
    if (!orbitArrival) return;
    clearTimeout(orbitArrival.timer);
    clearTimeout(orbitArrival.doneTimer);
    // Trạng thái cuối của các animation trùng với trạng thái tự nhiên, nên
    // huỷ đi không gây giật.
    orbitArrival.anims.forEach(anim => anim.cancel());
    orbitArrival = null;
    overlay?.classList.remove('is-arriving', 'is-blooming');
    orbitTokens.forEach(token => token.classList.remove('is-ready'));
    layoutOrbit();
    if (heartCharge === HEART_TAP_TARGET && !isFinalLetterUnlocked) completeHeartCharge();
    else startHeartAmbient();
}

// Tua nhanh: người xem chạm màn hình trong lúc chuyển cảnh.
function finishOrbitArrival() {
    if (!orbitArrival) return;
    if (orbitArrival.t0 == null) beginOrbitArrival();
    orbitArrival.anims.forEach(anim => anim.finish());
    completeOrbitArrival();
}

// Đóng/reset giữa cảnh đến: gỡ sạch, không chạy nốt.
function cancelOrbitArrival() {
    if (!orbitArrival) return;
    clearTimeout(orbitArrival.timer);
    clearTimeout(orbitArrival.doneTimer);
    orbitArrival.anims.forEach(anim => anim.cancel());
    orbitArrival = null;
    document.getElementById('memory-orbit')?.classList.remove('is-arriving', 'is-blooming');
    orbitTokens.forEach(token => token.classList.remove('is-ready'));
}

function closeMemoryOrbit() {
    const overlay = document.getElementById('memory-orbit');
    if (!overlay || !orbitOpen) return;

    closeOrbitCard();
    cancelOrbitArrival();
    stopHeartAmbient(true);
    stopOrbitLoop();
    clearHeartEffects();
    isHeartBursting = false;
    // Trả camera và lớp tối của màn mưa về như trước cú chuyển cảnh.
    if (typeof restoreRainSky === 'function') restoreRainSky();

    orbitOpen = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    isPopupOpen = false;
    // CHỈ bật lại cờ, KHÔNG gọi animate(). Hàm đó gọi requestAnimationFrame(animate)
    // vô điều kiện ngay dòng đầu, nên vòng lặp của nó chưa bao giờ dừng — nó chỉ
    // bỏ qua phần tính toán khi isPlaying false. Gọi lại là sinh thêm một vòng
    // rAF thứ hai chạy song song mãi mãi, và mỗi lần đóng orbit lại thêm một vòng.
    isPlaying = true;

    // Cùng cái bẫy mà closePopup() và closeFullLetter() đã dính: nút đóng nằm
    // trên overlay, overlay biến mất, cú click tiếp tục bubble lên window,
    // raycast trúng chiếc đèn nằm sau nút — và orbit mở lại ngay lập tức.
    lastClickTime = Date.now();
}

// ---- CARD LỜI NHẮN ----
function openOrbitCard(index) {
    if (isHeartBursting) return;
    const part = orbitMemories[index];
    const card = document.getElementById('orbit-card');
    const body = document.getElementById('orbit-card-body');
    if (!part || !card || !body) return;

    orbitCardIndex = index;
    // Dừng quỹ đạo khi đang đọc: ảnh vẫn bay sau lớp mờ chỉ tổ kéo mắt khỏi chữ.
    stopHeartAmbient(false);
    stopOrbitLoop();

    const label = escapeHtml(part.label || `Ký ức ${index + 1}`);
    body.innerHTML = `
        <button type="button" class="ol-back" onclick="closeOrbitCard()">
            <span aria-hidden="true">‹</span> QUAY LẠI
        </button>
        <div class="ol-card-paper">
            <p class="ol-card-eyebrow">${label}</p>
            ${buildPhotoMarkup(part)}
            <p class="ol-card-text">${escapeHtml(part.text)}</p>
        </div>
    `;

    card.classList.add('is-open');
    card.removeAttribute('data-closing');
    card.setAttribute('aria-hidden', 'false');

    const stage = document.getElementById('orbit-stage');
    if (stage) stage.classList.add('is-dimmed');
}

function closeOrbitCard() {
    const card = document.getElementById('orbit-card');
    if (!card || !card.classList.contains('is-open')) return;

    orbitCardIndex = -1;
    card.setAttribute('data-closing', 'true');
    card.setAttribute('aria-hidden', 'true');

    const stage = document.getElementById('orbit-stage');
    if (stage) stage.classList.remove('is-dimmed');

    // Giữ card lại đủ lâu cho animation thoát chạy hết rồi mới gỡ, đúng cách
    // bản gốc làm bằng state `closing`.
    setTimeout(() => {
        card.classList.remove('is-open');
        card.removeAttribute('data-closing');
        if (orbitOpen) {
            startOrbitLoop();
            syncHeartAmbientState();
        }
    }, ORBIT_CARD_CLOSE_MS);
}

// ---- BÀN PHÍM ----
document.addEventListener('keydown', event => {
    if (event.key === 'Tab' && document.getElementById('full-letter').classList.contains('is-open')) {
        const buttons = Array.from(document.querySelectorAll('#full-letter button'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
        }
        return;
    }
    if (event.key !== 'Escape' || !orbitOpen) return;

    if (document.getElementById('full-letter').classList.contains('is-open')) {
        event.stopImmediatePropagation();
        closeFullLetter();
        return;
    }

    if (document.getElementById('orbit-card')?.classList.contains('is-open')) {
        closeOrbitCard();
    } else {
        closeMemoryOrbit();
    }
});

// ---- TIẾT KIỆM TÀI NGUYÊN ----
// Chuyển tab thì huỷ vòng rAF hẳn, quay lại thì chạy tiếp. Không làm thì quỹ
// đạo vẫn quay trong nền và pin vẫn tụt dù không ai nhìn.
document.addEventListener('visibilitychange', () => {
    if (!orbitOpen) return;

    if (document.hidden) {
        stopHeartAmbient(false);
        stopOrbitLoop();
    } else if (!document.getElementById('orbit-card')?.classList.contains('is-open')) {
        startOrbitLoop();
        syncHeartAmbientState();
    }
});

const orbitMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const handleOrbitMotionChange = () => syncHeartAmbientState();
if (typeof orbitMotionQuery.addEventListener === 'function') {
    orbitMotionQuery.addEventListener('change', handleOrbitMotionChange);
} else if (typeof orbitMotionQuery.addListener === 'function') {
    orbitMotionQuery.addListener(handleOrbitMotionChange);
}
// ---- ĐỌC NỘI DUNG TỪ URL ----
// Cùng một trang deploy một lần có thể gửi cho nhiều người khác nhau, nội dung
// truyền qua URL. Hai cách:
//   1. Tham số thường:  ?name=...&text=câu 1,câu 2&music=...&image=...
//   2. Tham số c:       JSON mã hoá Base64 URL-safe — dùng khi thư dài hoặc có
//      dấu phẩy (cách 1 tách câu theo dấu phẩy nên không chứa được dấu phẩy).

// Giải mã tham số c đúng MỘT lần lúc nạp trang, thay vì giải mã lại ở mỗi lần
// đọc tham số như bản cũ.
function decodeUrlContent() {
  const encoded = new URLSearchParams(window.location.search).get("c");
  if (!encoded) return {};

  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(base64)))) || {};
  } catch (e) {
    console.error("Lỗi khi giải mã tham số c:", e);
    return {};
  }
}

const urlContent = decodeUrlContent();

// Khi mở bằng ?id=..., index.html đã tải cấu hình LoveGift trước khi nạp file
// này. Chuẩn hoá lời nhắn/ảnh về schema `letter` để các màn dùng chung dữ liệu.
const lovegiftConfig = window.LOVEGIFT_CONFIG || {};
const lovegiftImages = Array.isArray(lovegiftConfig.images) ? lovegiftConfig.images : [];
if (!Array.isArray(urlContent.letter) && Array.isArray(lovegiftConfig.messages) && lovegiftConfig.messages.length > 0) {
    // Lọc lời nhắn rỗng TRƯỚC khi ghép ảnh, để ảnh thứ i luôn đi với lời nhắn
    // thứ i — cùng thứ tự với orbitMemories bên dưới.
    urlContent.letter = lovegiftConfig.messages
        .map(text => String(text || '').trim())
        .filter(Boolean)
        .map((text, i) => ({
            text,
            photo: lovegiftImages[i] || lovegiftImages[0] || null,
            label: `Ký ức ${i + 1}`
        }));
}
if (lovegiftConfig.music && !urlContent.music) urlContent.music = lovegiftConfig.music;
if (lovegiftConfig.color) document.documentElement.style.setProperty('--amber', String(lovegiftConfig.color));

// toName/fromName đi qua đúng hai tham số mà phần còn lại của file đã đọc sẵn
// (`name`, `from`), nên không phải sửa chỗ nào khác. Trim vì dữ liệu nhập tay
// hay dính khoảng trắng đầu/cuối (" be siu xink").
const cleanConfigText = value => String(value == null ? '' : value).trim();
if (lovegiftConfig.toName && !urlContent.name) urlContent.name = cleanConfigText(lovegiftConfig.toName);
if (lovegiftConfig.fromName && !urlContent.from) urlContent.from = cleanConfigText(lovegiftConfig.fromName);
if (lovegiftConfig.finalMessage || lovegiftImages.length > 0) {
    const final = urlContent.final && typeof urlContent.final === 'object' ? urlContent.final : {};
    if (!final.message && lovegiftConfig.finalMessage) final.message = cleanConfigText(lovegiftConfig.finalMessage);
    // Người gửi thường tải lên nhiều ảnh hơn số lời nhắn; tấm dư cuối cùng để
    // dành cho lá thư kết thay vì bỏ không.
    if (!final.photo && lovegiftImages.length > 0) final.photo = lovegiftImages[lovegiftImages.length - 1];
    urlContent.final = final;
}

function getUrlParameter(name) {
  if (urlContent[name]) return urlContent[name];

  const regularParam = new URLSearchParams(window.location.search).get(name);
  if (regularParam) return regularParam;

  // Không có nhạc mặc định: chỉ phát nhạc người dùng tải lên (LoveGift hoặc ?music=)
  return null;
}

// ---- TRẠNG THÁI DÙNG CHUNG ----
// Cảnh Three.js của màn 1 do rain.js dựng. orbit.js ghi `isPlaying = false` để
// tắt phần tính toán của màn 1 khi trái tim ngân hà đã che kín màn hình.
let scene, camera, renderer;
let isPlaying = false;
// Có overlay (orbit, lá thư) đang che màn 1: cú giữ tay ở màn 1 phải bỏ qua.
let isPopupOpen = false;
// Mốc đóng overlay gần nhất: cú chạm vừa bấm nút đóng không được lọt xuống
// màn 1 và tính thành một lần giữ tay.
let lastClickTime = 0;
let preloadedPopupImages = [];

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- CHẶN NỘI DUNG ĐỘC HẠI TỪ URL ----
// Trang này SINH RA ĐỂ GỬI LINK: ai cũng có thể lấy link của bạn, gắn ?c= chứa
// payload rồi gửi tiếp cho người khác — và nó chạy trên đúng domain của bạn.
// Mà text/label/name/from đều được nhét vào innerHTML ở popup, lá thư và màn
// orbit, nên phải escape trước khi ghép chuỗi.
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Ảnh nằm trong thuộc tính src, nên escape thôi chưa đủ: `javascript:` và
// `data:text/html` vẫn chạy được dù không có dấu nháy nào. Vì vậy duyệt theo
// danh sách TRẮNG — chỉ http/https và đường dẫn tương đối — thay vì đi chặn
// từng scheme xấu, vốn luôn sót.
function safePhotoUrl(value) {
    if (!value) return null;

    const url = String(value).trim();

    // Chỉ dò scheme trên một bản đã bỏ hết ký tự điều khiển và khoảng trắng:
    // `java\nscript:alert(1)` là cách né bộ lọc quen thuộc, trình duyệt vẫn đọc
    // ra `javascript:`. Nhưng GIÁ TRỊ TRẢ VỀ luôn là `url` gốc — trả về bản đã
    // rút gọn thì mọi tên file có khoảng trắng ("anh cua em.jpg") sẽ hỏng.
    const probe = url.replace(/[\u0000-\u0020]/g, '');

    if (/^(https?:)?\/\//i.test(probe)) return url;   // https://... hoặc //...
    if (/^\.{0,2}\//.test(probe)) return url;         // ./photos/... , ../ , /photos/...
    if (/^[^:?#\\]+\.(webp|jpe?g|png|gif|avif)$/i.test(probe)) return url; // anh.webp

    console.warn('Bỏ qua ảnh có scheme không hợp lệ:', url);
    return null;
}

// Detect if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
}


// ---- NỘI DUNG: SÁU LỜI NHẮN NGẮN ----
// Bản cũ giữ lời chúc và ảnh ở hai mảng RỜI: chữ chạy tuần tự còn ảnh chọn ngẫu
// nhiên, nên câu chữ và tấm ảnh đi kèm chẳng liên quan gì tới nhau. Giờ mỗi lời
// nhắn là một object mang sẵn ảnh của nó, đi theo đúng thứ tự đã sắp.
//
// Mỗi lời nhắn giữ trong MỘT câu: nó hiện trên card của một tấm ảnh ở màn 2,
// phải đọc hết trong một nhịp thở. Chỗ để viết dài là lá thư cuối.
//
// `label` là câu chúc ngắn (tối đa 30 ký tự), hiện trên chip ảnh ở màn kết
// và dòng mở đầu trong popup. Giữ ngắn để chip đọc đủ trong hai dòng.
//
// Thứ tự sáu nhịp là có chủ đích, không phải sáu câu chúc rời: mở → hoài niệm →
// phố hội → KHOẢNG LẶNG → có em → lời hẹn. Nhịp chùng ở mảnh 4 là chỗ quan
// trọng nhất; một bộ toàn ngọt sẽ nhàm, phải có nhịp lặng thì mảnh cuối mới
// nặng. Thay nội dung thì nên giữ lại một nhịp như vậy.
const DEFAULT_LETTER = [
    {
        label: 'Gửi em một chút thương',
        photo: './photos/placeholder.svg',
        text: 'Hôm nay chẳng phải dịp gì, anh chỉ muốn nói là anh thương em.'
    },
    {
        label: 'Bông hồng dành riêng em',
        photo: './photos/placeholder.svg',
        text: 'Anh không giỏi nói lời hoa mỹ, nên gửi em cả một khu vườn trong lòng anh.'
    },
    {
        label: 'Nụ cười của em',
        photo: './photos/placeholder.svg',
        text: 'Em cười một cái, cả ngày của anh bừng sáng.'
    },
    {
        label: 'Cảm ơn em vì tất cả',
        photo: './photos/placeholder.svg',
        // Ảnh duy nhất chụp ban ngày -> cần hạ sáng bằng filter cho khỏi lạc tông
        daylight: true,
        text: 'Cảm ơn em đã luôn dịu dàng, mạnh mẽ và kiên nhẫn với anh.'
    },
    {
        label: 'Em xinh nhất hôm nay',
        photo: './photos/placeholder.svg',
        text: 'Hôm nay và mọi ngày, em luôn là người đẹp nhất trong mắt anh.'
    },
    {
        label: 'Mong em luôn hạnh phúc',
        photo: './photos/placeholder.svg',
        text: 'Mong em bớt mệt mỏi, thêm thật nhiều niềm vui, và luôn được là chính mình.'
    },
    {
        label: 'Bên em thêm nhiều mùa nữa',
        photo: "./photos/placeholder.svg",
        text: 'Năm sau, năm sau nữa, anh vẫn muốn là người nắm tay em.'
    }
];

const customMusic = getUrlParameter("music");
const recipientName = getUrlParameter("name") || 'em';
const senderName = getUrlParameter("from") || '';

// Pool ảnh dự phòng khi một `photo` load hỏng. MỌI file ở đây phải tồn tại
// thật: một fallback tự nó 404 thì còn tệ hơn là không có fallback.
const LOCAL_PHOTO_FALLBACKS = [
    './photos/placeholder.svg',
    './photos/placeholder.svg',
    './photos/placeholder.svg',
    './photos/placeholder.svg',
    './photos/placeholder.svg',
    './photos/placeholder.svg',
    "./photos/placeholder.svg"
];

function pickFallbackPhoto(exclude = '') {
    const choices = LOCAL_PHOTO_FALLBACKS.filter(photo => photo !== exclude);
    return choices[Math.floor(Math.random() * choices.length)] || LOCAL_PHOTO_FALLBACKS[0];
}

function buildLetter() {
    // Dạng đầy đủ: mảng letter trong tham số c, mỗi phần tử {text, photo, label}
    if (Array.isArray(urlContent.letter) && urlContent.letter.length > 0) {
        const parts = urlContent.letter
            .filter(part => part && part.text)
            .map((part, i) => ({
                text: String(part.text),
                // label tuỳ chọn: link cũ gửi đi trước khi có trường này vẫn chạy,
                // chỉ là chip trên token hiện "Ký ức 1, 2, 3..." thay cho tên riêng
                label: part.label ? String(part.label) : `Ký ức ${i + 1}`,
                photo: part.photo || null,
                daylight: Boolean(part.daylight)
            }));
        if (parts.length > 0) return parts;
    }

    // Dạng cũ vẫn chạy được: ?text=câu 1,câu 2 (+ ?image= dùng chung cho mọi đoạn)
    const customText = getUrlParameter("text");
    if (customText) {
        const sharedPhoto = getUrlParameter("image");
        const parts = String(customText)
            .split(',')
            .map(msg => msg.trim())
            .filter(msg => msg.length > 0)
            .map((text, i) => ({
                text,
                label: `Ký ức ${i + 1}`,
                photo: sharedPhoto || null,
                daylight: false
            }));
        if (parts.length > 0) return parts;
    }

    return DEFAULT_LETTER;
}

const letter = buildLetter().map(part => ({
    ...part,
    photo: safePhotoUrl(part.photo) || pickFallbackPhoto()
}));

// Ảnh bay quanh trái tim ở màn 2. Người gửi hay tải NHIỀU ảnh nhưng chỉ viết
// ÍT lời nhắn; nếu mỗi lời nhắn chỉ một token thì các ảnh dư biến mất. Nên khi
// số ảnh nhiều hơn số lời nhắn, mỗi ảnh một token và lời nhắn được dùng lặp
// vòng. `letter` giữ nguyên để nhịp khám phá ở màn 1 không bị kéo dài.
const orbitMemories = (() => {
    const images = lovegiftImages.map(safePhotoUrl).filter(Boolean);
    if (images.length <= letter.length) return letter;
    return images.map((photo, i) => {
        const source = letter[i % letter.length];
        return {
            text: source.text,
            label: i < letter.length ? source.label : `Ký ức ${i + 1}`,
            photo,
            daylight: i < letter.length ? source.daylight : false
        };
    });
})();
const finalInput = urlContent.final && typeof urlContent.final === 'object' ? urlContent.final : {};

// Lá thư kết (mở ra sau khi chạm đủ 3 lần vào trái tim ở màn Orbit) là LỜI KẾT
// ngắn gọn, không phải bản ghép lại toàn bộ các mảnh ký ức đã đọc — những mảnh
// đó đã có đất riêng của chúng ở các tấm ảnh trên quỹ đạo rồi. Một câu finalMessage
// từ LoveGift/API là đủ.
const DEFAULT_FINAL_MESSAGE = 'Anh chẳng cần dịp gì đặc biệt để nói thương em. Cảm ơn em đã làm những ngày bình thường của anh trở nên đặc biệt.';
const finalLetter = {
    title: String(finalInput.title || `Gửi ${recipientName}`),
    photo: safePhotoUrl(finalInput.photo) || [...letter].reverse().map(part => safePhotoUrl(part.photo)).find(Boolean) || null,
    message: String(finalInput.message || DEFAULT_FINAL_MESSAGE).trim(),
    sign: String(senderName || '').trim()
};

function hideLoading() {
    const loading = document.getElementById('loading');
    if (!loading || loading.dataset.hidden === '1') return;

    loading.dataset.hidden = '1';
    loading.style.opacity = '0';
    setTimeout(() => {
        loading.style.display = 'none';
    }, 400);

    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        threeContainer.style.opacity = '1';
    }
}


function createStars() {
    const starsContainer = document.getElementById('stars');
    
    for (let i = 0; i < 200; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 2 + 's';
        starsContainer.appendChild(star);
    }
}

// Create shooting stars
function createShootingStars() {
    const shootingStarsContainer = document.getElementById('shooting-stars');
    if (!shootingStarsContainer) return;

    // Create multiple shooting stars with random positions and delays
    const numShootingStars = 20; // Increased number of shooting stars
    
    for (let i = 0; i < numShootingStars; i++) {
        const shootingStar = document.createElement('div');
        shootingStar.className = 'shooting-star';
        
        // Random starting positions (top-right area for diagonal movement)
        const startX = Math.random() * (window.innerWidth * 0.8) + (window.innerWidth * 0.2);
        const startY = Math.random() * (window.innerHeight * 0.3);
        
        shootingStar.style.left = startX + 'px';
        shootingStar.style.top = startY + 'px';
        
        // Random animation delay (0-10 seconds)
        const delay = Math.random() * 10;
        shootingStar.style.animationDelay = delay + 's';
        
        // Add some size variation
        const size = 3 + Math.random() * 3; // 3-6px
        shootingStar.style.width = size + 'px';
        shootingStar.style.height = size + 'px';
        
        shootingStarsContainer.appendChild(shootingStar);
    }
    
    console.log(`Created ${numShootingStars} shooting stars`);
}


function buildPhotoMarkup(part) {
    const photo = safePhotoUrl(part.photo);
    if (!photo) return '';

    const dayClass = part.daylight ? ' class="is-daylight"' : '';
    // onerror: link ảnh từ URL người dùng có thể hỏng, khi đó thay bằng một ảnh
    // trong pool dự phòng thay vì để lại ô xám trống giữa trang thư.
    //
    // Đường dẫn fallback đi qua `data-fallback` chứ KHÔNG nhúng thẳng vào chuỗi
    // JS trong onerror: escapeHtml đổi `'` thành `&#39;`, mà trình duyệt giải mã
    // character reference TRƯỚC khi biên dịch handler, nên `pain'.jpeg` sẽ làm
    // `this.src='./photos/placeholder.svg'` vỡ cú pháp và fallback chết câm.
    return `<figure class="popup-photo">
                <img src="${escapeHtml(photo)}" alt=""${dayClass}
                     data-fallback="${escapeHtml(pickFallbackPhoto(photo))}"
                     onerror="this.onerror=null; this.src=this.dataset.fallback;">
            </figure>`;
}


// ---- HÌNH TRÁI TIM DÙNG CHUNG ----
// Trái tim là một CHÒM SAO GẤP KHÚC 14 đỉnh kiểu bản đồ tử vi. orbit.js dùng
// nó để vẽ chòm sao quanh tim ngân hà ở màn 2.
//
// Thứ tự đỉnh = thứ tự nét vẽ chạy: mũi tim → cạnh phải → thuỳ phải → hõm →
// thuỳ trái → cạnh trái → về mũi tim. Toạ độ chuẩn hoá 0–100 theo khung tim.
const HEART_CONSTELLATION = [
    [50.0, 100.0], // 0  mũi tim
    [63.1, 78.3],
    [84.0, 59.2],
    [100.0, 37.5], // 3  cạnh phải
    [100.0, 14.5],
    [83.8, 0.0],   // 5  đỉnh thuỳ phải
    [63.1, 1.3],
    [50.0, 15.8],  // 7  hõm giữa
    [36.9, 1.3],
    [16.2, 0.0],   // 9  đỉnh thuỳ trái
    [0.0, 14.5],
    [0.0, 37.5],   // 11 cạnh trái
    [16.0, 59.2],
    [36.9, 78.3]
];
// Tỉ lệ rộng/cao của chòm sao trong ảnh mẫu (420 × 392 px).

// Đường cong trái tim chuẩn (x = 16sin³t, y = 13cos t − 5cos2t − 2cos3t − cos4t)
// chuẩn hoá về cùng hệ 0–100 với HEART_CONSTELLATION: đỉnh thuỳ ở y ≈ 0, mũi
// tim ở y = 100. Dùng cho viền tim trơn mờ bao ngoài chòm sao và cho vành tim
// ở cao trào màn 2.
function heartCurveNormalized(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [((x + 16) / 32) * 100, ((11.8 - y) / 28.8) * 100];
}

function spawnConstellationFlash(x, y) {
    const flash = document.createElement('div');
    flash.className = 'constellation-flash';
    flash.style.left = `${x}px`;
    flash.style.top = `${y}px`;
    document.body.appendChild(flash);
    return flash;
}


// ---- LÁ THƯ HOÀN CHỈNH (màn kết) ----
// ---- CHỮ HIỆN DẦN TỪNG KÝ TỰ (lá thư cuối) ----
// Bản trước dùng một dải mask trượt ngang qua cả dòng — tính lại thì dòng chữ
// bị ẩn tiệt suốt gần nửa thời lượng đầu rồi mới lộ ra qua một dải mờ hẹp,
// không hề ra cảm giác "hiện từng chữ". Giờ MỖI KÝ TỰ là một span riêng, hiện
// lên tuần tự theo animation-delay — đúng nghĩa đen "từng chữ hiện một".
const HW_CHAR_STAGGER_MS = 34; // khoảng cách giữa hai ký tự hiện ra
const HW_LINE_GAP = 200;       // nhịp nhấc bút giữa hai dòng
const HW_MAX_TOTAL = 9000;     // trần tổng thời lượng, xem ghi chú ở startHandwriting
let handwritingTimer = null;

// Tách một khối chữ thành từng dòng, mỗi ký tự một span riêng để hiện lần
// lượt. Dấu cách giữ nguyên là text node thường (không bọc span) để trình
// duyệt vẫn có chỗ xuống dòng tự nhiên giữa các từ.
//
// `.hw-char` PHẢI là `display: inline` (không phải inline-block) — inline-block
// biến mỗi ký tự thành một "atomic inline", và CSS cho phép ngắt dòng ngay
// trước/sau MỌI atomic inline dù hai bên không hề có khoảng trắng. Bản đầu
// dùng inline-block (để dùng `transform: translateY` cho hiệu ứng nhấc chữ)
// nên chữ có thể xuống dòng giữa chừng một từ — đúng lỗi "xuống dòng linh
// tinh" thấy trên mobile. `display: inline` thường KHÔNG atomic nên chỉ ngắt
// được ở dấu cách thật, y hệt text thường; hiệu ứng nhấc chữ chuyển sang dùng
// `position: relative; top` — thuộc tính này áp dụng được cho inline thường,
// không cần inline-block như transform.
function buildHandwritingLines(el) {
    if (!el) return [];

    // Lần mở thứ hai, textContent đã là chữ ĐÃ tách dòng — các `\n` nằm giữa
    // những thẻ span nên đọc lại sẽ mất hết, cả đoạn dồn thành một dòng. Vì
    // vậy giữ nguyên văn bản gốc ngay lần đầu và luôn dựng lại từ nó.
    if (el.dataset.hwSource === undefined) el.dataset.hwSource = el.textContent;

    const lines = el.dataset.hwSource.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];

    el.textContent = '';
    return lines.map(line => {
        const wrap = document.createElement('span');
        wrap.className = 'hw-line';
        const charSpans = [];
        // Array.from thay vì duyệt theo index: giữ nguyên các ký tự có dấu tổ
        // hợp (nếu có) thành một khối, không cắt gãy giữa chữ cái và dấu.
        Array.from(line).forEach(ch => {
            if (ch === ' ') {
                wrap.appendChild(document.createTextNode(' '));
                return;
            }
            const span = document.createElement('span');
            span.className = 'hw-char';
            span.textContent = ch;
            wrap.appendChild(span);
            charSpans.push(span);
        });
        el.appendChild(wrap);
        return { node: wrap, charSpans };
    });
}

function startHandwriting(sheet) {
    if (!sheet || prefersReducedMotion()) return;

    let lines = [];
    // Chỉ viết tay phần chữ CỦA LÁ THƯ. `.full-letter-lead` là nhãn in hoa
    // giãn chữ — cho nó chạy nét bút thì lạc hẳn, cứ để nó nằm yên.
    [sheet.querySelector('.full-letter-title'), sheet.querySelector('.full-letter-final-message')]
        .forEach(el => { lines = lines.concat(buildHandwritingLines(el)); });
    if (!lines.length) return;

    // Thư tuỳ biến qua ?c= có thể rất dài; co khoảng cách giữa các ký tự lại
    // để người xem không phải ngồi đợi cả phút mới đọc hết.
    const totalChars = lines.reduce((sum, line) => sum + line.charSpans.length, 0);
    const rawTotal = totalChars * HW_CHAR_STAGGER_MS + lines.length * HW_LINE_GAP;
    const scale = rawTotal > HW_MAX_TOTAL ? HW_MAX_TOTAL / rawTotal : 1;
    const stagger = HW_CHAR_STAGGER_MS * scale;
    const lineGap = HW_LINE_GAP * scale;

    let at = 0;
    lines.forEach(line => {
        line.charSpans.forEach(span => {
            span.style.setProperty('--hw-char-delay', `${Math.round(at)}ms`);
            at += stagger;
        });
        at += lineGap;
    });

    sheet.classList.remove('is-written');
    // Cùng lý do như runHeartLightChase(): phải ép trình duyệt chốt style giữa
    // hai lần đổi class, không thì lần mở thứ hai gộp làm một và chữ hiện thẳng.
    void sheet.offsetWidth;
    sheet.classList.add('is-writing');

    clearTimeout(handwritingTimer);
    // +220ms: khớp thời lượng hwCharIn của CHÍNH ký tự cuối cùng (khai báo cố
    // định trong CSS), cộng thêm 150ms nghỉ trước khi khoá lại thành is-written.
    handwritingTimer = setTimeout(() => finishHandwriting(sheet), at + 220 + 150);
}

// Chạm vào thư là viết xong ngay. Người đọc lại lần hai không phải ngồi đợi.
function finishHandwriting(sheet) {
    if (!sheet) return;
    clearTimeout(handwritingTimer);
    handwritingTimer = null;
    sheet.classList.remove('is-writing');
    sheet.classList.add('is-written');
}

function openFullLetter() {
    if (typeof isFinalLetterUnlocked !== 'undefined' && !isFinalLetterUnlocked) return;
    const overlay = document.getElementById('full-letter');
    const sheet = document.getElementById('full-letter-sheet');
    if (!overlay || !sheet) return;
    if (typeof stopHeartAmbient === 'function') stopHeartAmbient(false);

    // Dựng một lần rồi dùng lại, tránh nạp lại toàn bộ ảnh mỗi lần mở
    if (!sheet.dataset.built) {
        // --i để CSS xếp độ trễ so le, từng đoạn dâng lên thay vì cả tờ bật ra
        // một lượt ngay sau chớp sáng.
        sheet.innerHTML = `
            <button class="final-letter-dismiss" type="button" onclick="closeFullLetter()" aria-label="Đóng lá thư">×</button>
            <div class="full-letter-title" tabindex="-1">${escapeHtml(finalLetter.title)}</div>
            <div class="full-letter-lead">Gửi người mình thương</div>
            <div class="full-letter-final-photo">${buildPhotoMarkup(finalLetter)}</div>
            <div class="full-letter-final-message">${escapeHtml(finalLetter.message)}</div>
            ${finalLetter.sign ? `<div class="full-letter-sign">Thương,<strong>${escapeHtml(finalLetter.sign)}</strong></div>` : ''}
            <button class="full-letter-close" type="button" onclick="closeFullLetter()">Đóng lá thư</button>
        `;
        sheet.dataset.built = '1';

        // Chạm vào tờ thư để viết xong ngay. Gắn ở giai đoạn capture và bỏ qua
        // khi bấm trúng nút, để cú chạm "bỏ qua" không nuốt mất nút Đóng.
        sheet.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            if (sheet.classList.contains('is-writing')) finishHandwriting(sheet);
        });
    }

    isPopupOpen = true; // chặn cú giữ tay ở màn 1 khi lá thư đang mở
    if (typeof stopOrbitLoop === 'function') stopOrbitLoop();
    const heartRect = document.getElementById('orbit-heart')?.getBoundingClientRect();
    if (heartRect) sheet.style.transformOrigin = `${heartRect.left + heartRect.width / 2 - sheet.getBoundingClientRect().left}px ${heartRect.top + heartRect.height / 2}px`;
    const orbitOverlay = document.getElementById('memory-orbit');
    if (orbitOverlay) orbitOverlay.inert = true;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.scrollTop = 0;
    document.body.classList.remove('lantern-hover');
    sheet.querySelector('.full-letter-title').focus({ preventScroll: true });

    // Chờ hết finalLetterBloom (600ms) rồi mới đặt bút: tờ thư đang phóng to
    // từ tâm trái tim mà chữ đã chạy thì hai chuyển động giẫm lên nhau.
    clearTimeout(handwritingTimer);
    handwritingTimer = setTimeout(() => startHandwriting(sheet), prefersReducedMotion() ? 0 : 620);
}

function closeFullLetter() {
    const overlay = document.getElementById('full-letter');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    // Đóng giữa chừng: huỷ luôn lượt viết đang chờ, không thì nó nổ sau khi
    // thư đã khuất và lần mở sau bị cắt ngang giữa dòng.
    clearTimeout(handwritingTimer);
    handwritingTimer = null;
    document.getElementById('full-letter-sheet')?.classList.remove('is-writing', 'is-written');
    const orbitOverlay = document.getElementById('memory-orbit');
    if (orbitOverlay) orbitOverlay.inert = false;
    if (typeof orbitOpen !== 'undefined' && orbitOpen) {
        // Cao trào để sân khấu orbit ở trạng thái đã zoom vào tim; lùi lại.
        if (typeof resetOrbitZoom === 'function') resetOrbitZoom();
        startOrbitLoop();
        if (typeof syncHeartAmbientState === 'function') syncHeartAmbientState();
        document.getElementById('orbit-heart')?.focus({ preventScroll: true });
    }

    // Lá thư được mở TỪ TRONG orbit (chạm trái tim ở giữa quỹ đạo). Đóng nó thì
    // người xem rơi trở lại màn orbit, chứ chưa về màn mưa — nên khoá
    // cú giữ tay phải giữ nguyên, không được mở ra ở đây.
    if (typeof orbitOpen === 'undefined' || !orbitOpen) {
        isPopupOpen = false;
    }

    // Cùng lý do như handleClickOutside: chặn cú click này bubble lên window
    // rồi lập tức mở lại lá thư
    lastClickTime = Date.now();

}


// Global variable to track music state
let isMusicPlaying = false;
let musicToggleButton = null;

// Biểu tượng loa. Bản cũ dán lặp đoạn SVG này ở 5 chỗ khác nhau, mỗi chỗ lệch
// nhau một chút -> gom về một nguồn duy nhất.
function speakerIcon(isOn) {
    const waves = isOn
        ? `<path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: soundWave 1.5s ease-in-out infinite"/>`
        : `<line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
           <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;

    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                ${waves}
            </svg>`;
}

// Đổi hình nút loa theo trạng thái. Màu nền để CSS lo, JS không gán inline nữa
// (bản cũ gán thẳng gradient đỏ vào style nên đè mất màu trong bảng màu mới).
function updateMusicButton(state) {
    if (!musicToggleButton) return;

    musicToggleButton.innerHTML = speakerIcon(state === 'on');
    musicToggleButton.classList.toggle('is-muted', state !== 'on');
    musicToggleButton.setAttribute(
        'aria-label',
        state === 'on' ? 'Tắt nhạc nền' : 'Bật nhạc nền'
    );
}

// Phát nhạc nền. Dùng chung cho nút loa VÀ cú chạm màn hình đầu tiên
// (primeAutoplayOnFirstTouch) — cả hai đều là user gesture hợp lệ để trình
// duyệt cho phép phát audio có tiếng.
function playBackgroundMusic() {
    const audio = document.getElementById('backgroundMusic');
    if (!audio) return Promise.reject(new Error('no audio element'));

    // Bài hát tuỳ chỉnh (LoveGift hoặc ?music=) chỉ nạp vào audio Ở ĐÂY, lúc
    // đã có gesture — nạp sớm hơn thì thiếu user gesture, trình duyệt chặn
    // autoplay. Bản cũ có playBackgroundMusic() làm việc này nhưng không hàm
    // nào gọi nó, nên nút loa luôn phát nhạc mặc định hard code trong thẻ
    // <audio>, dù link đã kèm nhạc riêng.
    if (customMusic && audio.dataset.customSrcApplied !== '1') {
        audio.src = customMusic;
        audio.load();
        audio.dataset.customSrcApplied = '1';
    }

    audio.muted = false;
    audio.volume = 0.3;
    return audio.play().then(() => {
        isMusicPlaying = true;
        updateMusicButton('on');
    });
}

// Create persistent music toggle button
function createMusicToggleButton() {
    if (musicToggleButton) return; // Already exists

    const button = document.createElement('button');
    button.className = 'music-toggle-button';
    button.innerHTML = speakerIcon(false);
    button.setAttribute('aria-label', 'Bật nhạc nền');
    // Toàn bộ style/keyframes/hover nằm trong index.html để media query mobile
    // (chuyển nút xuống góc dưới phải) có thể áp dụng được

    const toggleMusic = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Người dùng đã chú ý tới nút rồi, không cần nhấp nháy nữa
        button.classList.add('is-settled');

        const audio = document.getElementById('backgroundMusic');
        if (!audio) return;

        if (isMusicPlaying) {
            audio.pause();
            isMusicPlaying = false;
            updateMusicButton('off');
            return;
        }

        playBackgroundMusic().catch(error => {
            console.log('Không phát được nhạc:', error);
            isMusicPlaying = false;
            updateMusicButton('off');
        });
    };

    button.addEventListener('click', toggleMusic);
    // touchend cùng với click sẽ khiến một cú chạm trên mobile chạy toggle HAI
    // lần (bật rồi tắt ngay). Chỉ gắn touchend khi đúng là thiết bị cảm ứng, và
    // toggleMusic đã preventDefault nên trình duyệt không bắn thêm click giả.
    if (isMobileDevice()) {
        button.addEventListener('touchend', toggleMusic);
    }

    document.body.appendChild(button);
    musicToggleButton = button;
}

// Cú chạm/click ĐẦU TIÊN ở bất kỳ đâu trên trang (cú giữ tay ở màn mưa,
// nút loa, v.v.) cũng là một user gesture hợp lệ — tận dụng nó để tự phát nhạc,
// khỏi bắt người xem phải tìm đúng nút loa trước. 'touchend' và 'click' đều
// gắn vì cùng một cú chạm trên mobile bắn cả hai; cờ musicAutoplayAttempted
// chặn gọi audio.play() hai lần cho một lượt chạm (isMusicPlaying chỉ được
// set SAU khi promise play() resolve, nên không đủ nhanh để tự chặn).
let musicAutoplayAttempted = false;
function primeAutoplayOnFirstTouch() {
    const tryStart = () => {
        if (musicAutoplayAttempted || isMusicPlaying) return;
        musicAutoplayAttempted = true;
        playBackgroundMusic().catch(() => {
            // Trình duyệt vẫn từ chối (hiếm) — nút loa còn đó để bấm tay, và
            // cho phép lượt chạm sau thử lại.
            musicAutoplayAttempted = false;
        });
    };
    window.addEventListener('touchend', tryStart, { once: true, passive: true });
    window.addEventListener('click', tryStart, { once: true });
}

( function () {

	/**
 * Full-screen textured quad shader
 */
	var CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`
	};

	THREE.CopyShader = CopyShader;

} )();
( function () {

	/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

	const LuminosityHighPassShader = {
		shaderID: 'luminosityHighPass',
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'luminosityThreshold': {
				value: 1.0
			},
			'smoothWidth': {
				value: 1.0
			},
			'defaultColor': {
				value: new THREE.Color( 0x000000 )
			},
			'defaultOpacity': {
				value: 0.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
	};

	THREE.LuminosityHighPassShader = LuminosityHighPassShader;

} )();
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;

			if ( renderTarget === undefined ) {

				const parameters = {
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					format: THREE.RGBAFormat
				};
				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio, parameters );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = []; // dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}

		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}

		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		removePass( pass ) {

			const index = this.passes.indexOf( pass );

			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}

		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}

		render( deltaTime ) {

			// deltaTime value is in seconds
			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;

			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil; //context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime ); //context.stencilFunc( context.EQUAL, 1, 0xffffffff );

						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}

		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}

		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );

			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}

		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}

	}

	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true; // if set to true, the pass indicates to swap read and write buffer after rendering

			this.needsSwap = true; // if set to true, the pass clears its buffer before rendering

			this.clear = false; // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.

			this.renderToScreen = false;

		}

		setSize( ) {}

		render( ) {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	} // Helper for passes that need to fill the viewport with a single quad.


	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 ); // https://github.com/mrdoob/three.js/pull/21358


	const _geometry = new THREE.BufferGeometry();

	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );

	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}

		dispose() {

			this._mesh.geometry.dispose();

		}

		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}

		get material() {

			return this._mesh.material;

		}

		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;

			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );

			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';

			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();
( function () {

	/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

	class UnrealBloomPass extends THREE.Pass {

		constructor( resolution, strength, radius, threshold ) {

			super();
			this.strength = strength !== undefined ? strength : 1;
			this.radius = radius;
			this.threshold = threshold;
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 ); // create color only once here, reuse it later inside the render function

			this.clearColor = new THREE.Color( 0, 0, 0 ); // render targets

			const pars = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat
			};
			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;
			let resx = Math.round( this.resolution.x / 2 );
			let resy = Math.round( this.resolution.y / 2 );
			this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
			this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
			this.renderTargetBright.texture.generateMipmaps = false;

			for ( let i = 0; i < this.nMips; i ++ ) {

				const renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
				renderTargetHorizonal.texture.generateMipmaps = false;
				this.renderTargetsHorizontal.push( renderTargetHorizonal );
				const renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
				renderTargetVertical.texture.generateMipmaps = false;
				this.renderTargetsVertical.push( renderTargetVertical );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // luminosity high pass material


			if ( THREE.LuminosityHighPassShader === undefined ) console.error( 'THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader' );
			const highPassShader = THREE.LuminosityHighPassShader;
			this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
			this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
			this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
			this.materialHighPassFilter = new THREE.ShaderMaterial( {
				uniforms: this.highPassUniforms,
				vertexShader: highPassShader.vertexShader,
				fragmentShader: highPassShader.fragmentShader,
				defines: {}
			} ); // Gaussian Blur Materials

			this.separableBlurMaterials = [];
			const kernelSizeArray = [ 3, 5, 7, 9, 11 ];
			resx = Math.round( this.resolution.x / 2 );
			resy = Math.round( this.resolution.y / 2 );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // Composite material


			this.compositeMaterial = this.getCompositeMaterial( this.nMips );
			this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
			this.compositeMaterial.needsUpdate = true;
			const bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
			this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
			this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors; // copy material

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.UnrealBloomPass relies on THREE.CopyShader' );

			}

			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.basic = new THREE.MeshBasicMaterial();
			this.fsQuad = new THREE.FullScreenQuad( null );

		}

		dispose() {

			for ( let i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

				this.renderTargetsHorizontal[ i ].dispose();

			}

			for ( let i = 0; i < this.renderTargetsVertical.length; i ++ ) {

				this.renderTargetsVertical[ i ].dispose();

			}

			this.renderTargetBright.dispose();

		}

		setSize( width, height ) {

			let resx = Math.round( width / 2 );
			let resy = Math.round( height / 2 );
			this.renderTargetBright.setSize( resx, resy );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.renderTargetsHorizontal[ i ].setSize( resx, resy );
				this.renderTargetsVertical[ i ].setSize( resx, resy );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

		}

		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setClearColor( this.clearColor, 0 );
			if ( maskActive ) renderer.state.buffers.stencil.setTest( false ); // Render input to screen

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.basic;
				this.basic.map = readBuffer.texture;
				renderer.setRenderTarget( null );
				renderer.clear();
				this.fsQuad.render( renderer );

			} // 1. Extract Bright Areas


			this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
			this.fsQuad.material = this.materialHighPassFilter;
			renderer.setRenderTarget( this.renderTargetBright );
			renderer.clear();
			this.fsQuad.render( renderer ); // 2. Blur All the mips progressively

			let inputRenderTarget = this.renderTargetBright;

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.fsQuad.material = this.separableBlurMaterials[ i ];
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				inputRenderTarget = this.renderTargetsVertical[ i ];

			} // Composite All the mips


			this.fsQuad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
			renderer.clear();
			this.fsQuad.render( renderer ); // Blend it additively over the input texture

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
			if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );

			} // Restore renderer settings


			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}

		getSeperableBlurMaterial( kernelRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'KERNEL_RADIUS': kernelRadius,
					'SIGMA': kernelRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
			} );

		}

		getCompositeMaterial( nMips ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'NUM_MIPS': nMips
				},
				uniforms: {
					'blurTexture1': {
						value: null
					},
					'blurTexture2': {
						value: null
					},
					'blurTexture3': {
						value: null
					},
					'blurTexture4': {
						value: null
					},
					'blurTexture5': {
						value: null
					},
					'dirtTexture': {
						value: null
					},
					'bloomStrength': {
						value: 1.0
					},
					'bloomFactors': {
						value: null
					},
					'bloomTintColors': {
						value: null
					},
					'bloomRadius': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform sampler2D dirtTexture;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
			} );

		}

	}

	UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.UnrealBloomPass = UnrealBloomPass;

} )();
