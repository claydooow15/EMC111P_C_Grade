import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';


class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    //Movement
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
  }

  _LoadModels() {
    
    
    const loader1 = new FBXLoader();
    loader1.setPath('./resources/zombie/');
    loader1.load('demon.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader1 = new FBXLoader(this._manager);
      loader1.setPath('./resources/zombie/');
      loader1.load('walk.fbx', (a) => { _OnLoad('walk', a); });
      loader1.load('run.fbx', (a) => { _OnLoad('run', a); });
      loader1.load('idle.fbx', (a) => { _OnLoad('idle', a); });
      loader1.load('dance.fbx', (a) => { _OnLoad('dance', a); });
    });
  }

  Update(timeInSeconds) {
    if (!this._target) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this._stateMachine._currentState.Name == 'dance') {
      acc.multiplyScalar(0.0);
    }
//character forward movment
    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    oldPosition.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true;
        break;
      case 65: // a
        this._keys.left = true;
        break;
      case 83: // s
        this._keys.backward = true;
        break;
      case 68: // d
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        //this._keys.shift = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
        this._camera.position.set(80, 35, 30); //new camera position
        break;
      case 65: // a
        this._keys.left = false;
        break;
      case 83: // s
        this._keys.backward = false;
        break;
      case 68: // d
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null; 
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
    this._AddState('dance', DanceState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};


class DanceState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'dance';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['dance'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['dance'].action;
    
    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(_) {
  }
};


class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } else if (input._keys.space) {
      this._parent.SetState('dance');
    }
  }
};


class CharacterControllerDemo {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(80, 35, 45); //70 for mirror

    this._scene = new THREE.Scene();

//start here for new sprites((1))

/////////////////////BUILDINGS//////////////////////

///Building A - 1///
//base//
let ahousebase1Geometry = new THREE.BoxBufferGeometry(60,60,60)
let ahousebase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide})
];
let ahousebase1Materials = new THREE.MeshFaceMaterial(ahousebase1Texture);
let ahousebase1Cube = new THREE.Mesh(ahousebase1Geometry, ahousebase1Materials);
this._scene.add(ahousebase1Cube);
ahousebase1Cube.position.x=40
ahousebase1Cube.position.y=30
ahousebase1Cube.position.z=200
//roof//
let ahouseroof1Geometry = new THREE.CylinderBufferGeometry(20,50,40)
let ahouseroof1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide})
];
let ahouseroof1Materials = new THREE.MeshFaceMaterial(ahouseroof1Texture);
let ahouseroof1Cylinder = new THREE.Mesh(ahouseroof1Geometry, ahouseroof1Materials);
this._scene.add(ahouseroof1Cylinder);
ahouseroof1Cylinder.position.x=40
ahouseroof1Cylinder.position.y=80
ahouseroof1Cylinder.position.z=200
//door//
let ahousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let ahousedoor1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide})
];
let ahousedoor1Materials = new THREE.MeshFaceMaterial(ahousedoor1Texture);
let ahousedoor1Cube = new THREE.Mesh(ahousedoor1Geometry, ahousedoor1Materials);
this._scene.add(ahousedoor1Cube);
ahousedoor1Cube.position.x=40
ahousedoor1Cube.position.y=10
ahousedoor1Cube.position.z=170

//static character add-on
const loader = new FBXLoader();
    loader.setPath('./resources/zombie/');
    loader.load('orangerobot.fbx', (fbx) => {
      fbx.scale.setScalar(0.05);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this._target1 = fbx;
      this._scene.add(this._target1);
      this._target1.position.x=-80
      this._target1.position.y=25
      this._target1.position.z=20
    });


////////////////////STREET LIGHTS//////////////////
////sl1////
//street light pole
let poleGeometry = new THREE.CylinderGeometry( 1.5, 1.5, 100, 32);
let poleMaterial = new THREE.MeshBasicMaterial( {color: "#8f6558"} );
let poleMesh = new THREE.Mesh(poleGeometry, poleMaterial );
this._scene.add( poleMesh );

poleMesh.position.y = -10
poleMesh.position.x = 0
poleMesh.position.z = 395

//street light bulb
let bulbGeometry = new THREE.CubeGeometry( 8, 10, 8);
let bulbMaterial = new THREE.MeshBasicMaterial( {color: "#808080"} );
let bulbMesh = new THREE.Mesh( bulbGeometry, bulbMaterial );
this._scene.add(bulbMesh );

bulbMesh.position.y = 32
bulbMesh.position.x = 0
bulbMesh.position.z = 395
bulbMesh.rotation.y = 1


//LAMP MISC
let lampmiscGeometry = new THREE.CubeGeometry( 4, 2, 14);
let lampmiscMaterial = new THREE.MeshBasicMaterial( {color: "#808080"} );
let lampmiscMesh = new THREE.Mesh(lampmiscGeometry, lampmiscMaterial );
this._scene.add( lampmiscMesh );

lampmiscMesh.position.y = 22
lampmiscMesh.position.x = 0
lampmiscMesh.position.z = 395
lampmiscMesh.rotation.y= 1

//LAMP BASE
let basegeometry = new THREE.ConeGeometry( 6, 5, 8);
let basematerial = new THREE.MeshBasicMaterial( {color: "#808080"} );
let baseMesh = new THREE.Mesh( basegeometry, basematerial );
this._scene.add( baseMesh);

baseMesh.position.y = -1.5
baseMesh.position.x = 0
baseMesh.position.z = 395
baseMesh.rotation.y = 1


//end here((1))

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);

    const controls = new OrbitControls(
      this._camera, this._threejs.domElement);
    controls.target.set(0, 10, 0);
    controls.update();


//Background   
let bgGeometry = new THREE.BoxBufferGeometry(500,300,500);
let bgGround = 
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/backgroundTexture.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/backgroundTexture.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/backgroundTexture.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/concreteTexture.jpg'), side: THREE.DoubleSide}),


];
let bgMaterials = new THREE.MeshFaceMaterial(bgGround);
let bgCube = new THREE.Mesh(bgGeometry, bgMaterials);
this._scene.add(bgCube);
bgCube.position.x=0
bgCube.position.y=150
bgCube.position.z=0
// this can vary from the position of your camera   


    this._mixers = [];
    this._previousRAF = null;

    this._LoadAnimatedModel();
    this._RAF();
  }

  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new BasicCharacterController(params);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new CharacterControllerDemo();
});
