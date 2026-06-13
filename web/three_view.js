/**
 * ═══════════════════════════════════════════════
 *  VILY 3D Desk Robot Viewer
 *  Renders an interactive 3D procedural model of VILY
 *  using Three.js, with live face-canvas texture mapping.
 * ═══════════════════════════════════════════════
 */

class Robot3DView {
    constructor(containerId, faceCanvasId) {
        this.container = document.getElementById(containerId);
        this.faceCanvas = document.getElementById(faceCanvasId);
        
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.animationFrameId = null;
        
        // 3D Objects
        this.robotGroup = null;
        this.headMesh = null;
        this.leftWheel = null;
        this.rightWheel = null;
        this.neckJoint = null;
        
        // Textures & Materials
        this.faceTexture = null;
        this.faceMaterial = null;
        
        // Physics/Anim State
        this.wheelRotation = 0;
        this.targetNeckRotationY = 0;
        this.targetNeckRotationX = 0;
        this.neckRotationY = 0;
        this.neckRotationX = 0;
        
        this.isMoving = false;
        this.moveSpeed = 0;
        
        this.init();
    }

    init() {
        if (!THREE) {
            console.error('[3D] Three.js not loaded!');
            return;
        }

        const width = this.container.clientWidth || 320;
        const height = this.container.clientHeight || 320;

        // 1. Scene & Renderer
        this.scene = new THREE.Scene();
        // Slick dark space background or slightly lighter gradient
        this.scene.background = new THREE.Color(0x12122a); 
        this.scene.fog = new THREE.FogExp2(0x12122a, 0.15);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Clear previous content
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(0, 3, 7.5);

        // 3. Controls (OrbitControls)
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 3;
            this.controls.maxDistance = 12;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
        }

        // 4. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x7c5cfc, 0.85); // Purple accent light
        dirLight.position.set(4, 8, 4);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 25;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);

        // Warm fill light
        const fillLight = new THREE.DirectionalLight(0x4facfe, 0.5); // Blue fill
        fillLight.position.set(-4, 2, -4);
        this.scene.add(fillLight);

        // Head screen glow light
        const screenLight = new THREE.PointLight(0x4facfe, 0.8, 3);
        screenLight.position.set(0, 1.2, 0.8);
        this.scene.add(screenLight);

        // 5. Floor (Desk)
        const floorGeo = new THREE.CylinderGeometry(15, 15, 0.2, 32);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x16162e,
            roughness: 0.8,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -0.1;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add a nice grid on the desk
        const gridHelper = new THREE.GridHelper(30, 30, 0x7c5cfc, 0x222244);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // 6. Build the Robot Model
        this.buildRobot();

        // 7. Event listeners
        window.addEventListener('resize', this.onResize.bind(this));

        // 8. Start loop
        this.animate();
    }

    buildRobot() {
        this.robotGroup = new THREE.Group();
        this.robotGroup.position.y = 0.2; // raise slightly above desk grid
        this.scene.add(this.robotGroup);

        const ironMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c2c54,
            roughness: 0.4,
            metalness: 0.8
        });

        const darkMetalMaterial = new THREE.MeshStandardMaterial({
            color: 0x1b1b36,
            roughness: 0.6,
            metalness: 0.5
        });

        const glowingBlueMaterial = new THREE.MeshBasicMaterial({
            color: 0x4facfe
        });

        // ──── A. Tracks Base ────
        const baseGeo = new THREE.BoxGeometry(1.6, 0.3, 1.8);
        const baseMesh = new THREE.Mesh(baseGeo, darkMetalMaterial);
        baseMesh.position.y = 0.35;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.robotGroup.add(baseMesh);

        // Wheels/Treads
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
        
        // Left wheel
        this.leftWheel = new THREE.Mesh(wheelGeo, ironMaterial);
        this.leftWheel.rotation.z = Math.PI / 2;
        this.leftWheel.position.set(-0.9, 0.4, 0);
        this.leftWheel.castShadow = true;
        this.robotGroup.add(this.leftWheel);

        // Right wheel
        this.rightWheel = new THREE.Mesh(wheelGeo, ironMaterial);
        this.rightWheel.rotation.z = Math.PI / 2;
        this.rightWheel.position.set(0.9, 0.4, 0);
        this.rightWheel.castShadow = true;
        this.robotGroup.add(this.rightWheel);

        // Tread details (Outer side plates)
        const plateGeo = new THREE.BoxGeometry(0.05, 0.9, 2.0);
        const leftPlate = new THREE.Mesh(plateGeo, darkMetalMaterial);
        leftPlate.position.set(-1.0, 0.4, 0);
        leftPlate.castShadow = true;
        this.robotGroup.add(leftPlate);

        const rightPlate = new THREE.Mesh(plateGeo, darkMetalMaterial);
        rightPlate.position.set(1.0, 0.4, 0);
        rightPlate.castShadow = true;
        this.robotGroup.add(rightPlate);

        // Decorative side status bar lights
        const barGeo = new THREE.BoxGeometry(0.06, 0.08, 1.2);
        const leftBar = new THREE.Mesh(barGeo, glowingBlueMaterial);
        leftBar.position.set(-1.03, 0.5, 0);
        this.robotGroup.add(leftBar);

        const rightBar = new THREE.Mesh(barGeo, glowingBlueMaterial);
        rightBar.position.set(1.03, 0.5, 0);
        this.robotGroup.add(rightBar);

        // ──── B. Neck ────
        this.neckJoint = new THREE.Group();
        this.neckJoint.position.set(0, 0.5, 0); // pivots from center of base
        this.robotGroup.add(this.neckJoint);

        const neckGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.7, 16);
        const neckMesh = new THREE.Mesh(neckGeo, ironMaterial);
        neckMesh.position.y = 0.35;
        neckMesh.castShadow = true;
        this.neckJoint.add(neckMesh);

        // ──── C. Head Assembly ────
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.7, 0);
        this.neckJoint.add(headGroup);

        // Head Shell (back and sides)
        const shellGeo = new THREE.BoxGeometry(1.6, 1.2, 1.0);
        const shellMesh = new THREE.Mesh(shellGeo, darkMetalMaterial);
        shellMesh.castShadow = true;
        headGroup.add(shellMesh);

        // Decorative ears (cylinders on side of head)
        const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
        const leftEar = new THREE.Mesh(earGeo, ironMaterial);
        leftEar.rotation.z = Math.PI / 2;
        leftEar.position.set(-0.85, 0, 0);
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, ironMaterial);
        rightEar.rotation.z = Math.PI / 2;
        rightEar.position.set(0.85, 0, 0);
        headGroup.add(rightEar);

        // ──── D. Face Screen (The Texture) ────
        // We use the 2D canvas dynamically rendered by face.js as a texture!
        this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
        this.faceTexture.colorSpace = THREE.SRGBColorSpace;
        this.faceTexture.minFilter = THREE.LinearFilter;

        this.faceMaterial = new THREE.MeshBasicMaterial({
            map: this.faceTexture,
            transparent: true
        });

        const screenGeo = new THREE.PlaneGeometry(1.45, 1.05);
        this.headMesh = new THREE.Mesh(screenGeo, this.faceMaterial);
        // Position screen slightly forward on head to prevent z-fighting
        this.headMesh.position.set(0, 0, 0.505);
        headGroup.add(this.headMesh);

        // Bezel around screen
        const bezelGeo = new THREE.BoxGeometry(1.5, 1.1, 0.02);
        const bezelMesh = new THREE.Mesh(bezelGeo, ironMaterial);
        bezelMesh.position.set(0, 0, 0.495);
        headGroup.add(bezelMesh);
    }

    onResize() {
        if (!this.container || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    setMovement(direction, speed) {
        if (speed > 0) {
            this.isMoving = true;
            this.moveSpeed = speed;
            
            // Tilt head slightly in direction of movement
            switch (direction) {
                case 'forward':
                    this.targetNeckRotationX = 0.12;
                    this.targetNeckRotationY = 0;
                    break;
                case 'backward':
                    this.targetNeckRotationX = -0.12;
                    this.targetNeckRotationY = 0;
                    break;
                case 'left': case 'spin-left':
                    this.targetNeckRotationY = 0.25;
                    this.targetNeckRotationX = 0;
                    break;
                case 'right': case 'spin-right':
                    this.targetNeckRotationY = -0.25;
                    this.targetNeckRotationX = 0;
                    break;
                case 'forward-left':
                    this.targetNeckRotationX = 0.1;
                    this.targetNeckRotationY = 0.15;
                    break;
                case 'forward-right':
                    this.targetNeckRotationX = 0.1;
                    this.targetNeckRotationY = -0.15;
                    break;
                default:
                    this.targetNeckRotationX = 0;
                    this.targetNeckRotationY = 0;
            }
        } else {
            this.isMoving = false;
            this.moveSpeed = 0;
            this.targetNeckRotationX = 0;
            this.targetNeckRotationY = 0;
        }
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        // 1. Update live face texture!
        if (this.faceTexture) {
            this.faceTexture.needsUpdate = true;
        }

        // 2. Physics & animations
        const dt = 0.016; // approximate time delta
        
        // Spin wheels if moving
        if (this.isMoving) {
            const rotDelta = (this.moveSpeed / 100) * 0.15;
            this.wheelRotation += rotDelta;
            
            if (this.leftWheel && this.rightWheel) {
                this.leftWheel.rotation.x = this.wheelRotation;
                this.rightWheel.rotation.x = this.wheelRotation;
            }
        }

        // Smoothly interpolate neck joints rotation
        const lerp = (a, b, t) => a + (b - a) * t;
        this.neckRotationX = lerp(this.neckRotationX, this.targetNeckRotationX, 0.1);
        this.neckRotationY = lerp(this.neckRotationY, this.targetNeckRotationY, 0.1);

        if (this.neckJoint) {
            this.neckJoint.rotation.x = this.neckRotationX;
            this.neckJoint.rotation.y = this.neckRotationY;
        }

        // Idle breathing neck tilt (very subtle)
        if (!this.isMoving) {
            const t = Date.now() / 1500;
            this.neckJoint.rotation.x = this.neckRotationX + Math.sin(t) * 0.03;
            this.neckJoint.rotation.y = this.neckRotationY + Math.cos(t * 0.5) * 0.02;
        }

        // 3. Render
        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this.onResize);
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
