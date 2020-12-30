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
  //Demon model
  _LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('./resources/zombie/');
    loader.load('demon.fbx', (fbx) => { //character model in this line
      fbx.scale.setScalar(0.15);
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
      //Breakdancing animation
      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/zombie/');
      loader.load('demonnwalk.fbx', (a) => { _OnLoad('walk', a); }); //walk animation here
      loader.load('demonidle.fbx', (a) => { _OnLoad('idle', a); }); //idle or standstill animation here
      loader.load('demonbreakdance.fbx', (a) => { _OnLoad('animation', a); }); //change animations (dance and etc. here)
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

    if (this._stateMachine._currentState.Name == 'animation') {
      acc.multiplyScalar(0.0);
    }
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
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
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
    this._AddState('animation', DanceState);
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
    return 'animation';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['animation'].action;
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
    const action = this._parent._proxy._animations['animation'].action;
    
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
      this._parent.SetState('animation');
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
let ahouseroof1Geometry = new THREE.CylinderBufferGeometry(10,50,30)
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
ahouseroof1Cylinder.position.y=70
ahouseroof1Cylinder.position.z=200
//door//
let ahousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let ahousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide});
let ahousedoor1Cube = new THREE.Mesh(ahousedoor1Geometry, ahousedoor1Materials);
this._scene.add(ahousedoor1Cube);
ahousedoor1Cube.position.x=40
ahousedoor1Cube.position.y=10
ahousedoor1Cube.position.z=170
//first window //
let afirstwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let afirstwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let afirstwindow1Cube = new THREE.Mesh(afirstwindow1Geometry, afirstwindow1Materials);
this._scene.add(afirstwindow1Cube);
afirstwindow1Cube.position.x=60
afirstwindow1Cube.position.y=20
afirstwindow1Cube.position.z=170
//second window//
let asecondwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let asecondwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let asecondwindow1Cube = new THREE.Mesh(asecondwindow1Geometry, asecondwindow1Materials);
this._scene.add(asecondwindow1Cube);
asecondwindow1Cube.position.x=20
asecondwindow1Cube.position.y=20
asecondwindow1Cube.position.z=170

///first base///
let bhousefirstbase1Geometry = new THREE.BoxBufferGeometry(70,50,60)
let bhousefirstbase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide})
];
let bhousefirstbase1Materials = new THREE.MeshFaceMaterial(bhousefirstbase1Texture);
let bhousefirstbase1Cube = new THREE.Mesh(bhousefirstbase1Geometry, bhousefirstbase1Materials);
this._scene.add(bhousefirstbase1Cube);
bhousefirstbase1Cube.position.x=-50
bhousefirstbase1Cube.position.y=25
bhousefirstbase1Cube.position.z=200
///second base///
let bhousesecondbase1Geometry = new THREE.BoxBufferGeometry(70,80,80)
let bhousesecondbase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house3Texture.jpg'), side: THREE.DoubleSide})
];
let bhousesecondbase1Materials = new THREE.MeshFaceMaterial(bhousesecondbase1Texture);
let bhousesecondbase1Cube = new THREE.Mesh(bhousesecondbase1Geometry, bhousesecondbase1Materials);
this._scene.add(bhousesecondbase1Cube);
bhousesecondbase1Cube.position.x=-120
bhousesecondbase1Cube.position.y=25
bhousesecondbase1Cube.position.z=200
//Door//
let bhousedoor1Geometry = new THREE.BoxBufferGeometry(20,35,5)
let bhousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door3Texture.jpg'), side: THREE.DoubleSide});
let bhousedoor1Cube = new THREE.Mesh(bhousedoor1Geometry, bhousedoor1Materials);
this._scene.add(bhousedoor1Cube);
bhousedoor1Cube.position.x=-120
bhousedoor1Cube.position.y=18
bhousedoor1Cube.position.z=160
//window 1//
let bwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let bwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let bwindow1Cube = new THREE.Mesh(bwindow1Geometry, bwindow1Materials);
this._scene.add(bwindow1Cube);
bwindow1Cube.position.x=-145
bwindow1Cube.position.y=20
bwindow1Cube.position.z=160
//window 2//
let bwindow2Geometry = new THREE.BoxBufferGeometry(10,20,5)
let bwindow2Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let bwindow2Cube = new THREE.Mesh(bwindow2Geometry, bwindow2Materials);
this._scene.add(bwindow2Cube);
bwindow2Cube.position.x=-95
bwindow2Cube.position.y=20
bwindow2Cube.position.z=160
//Garage Door//
let bgaragedoor1Geometry = new THREE.BoxBufferGeometry(50,45,5)
let bgaragedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/garageTexture.jpg'), side: THREE.DoubleSide});
let bgaragedoor1Cube = new THREE.Mesh(bgaragedoor1Geometry, bgaragedoor1Materials);
this._scene.add(bgaragedoor1Cube);
bgaragedoor1Cube.position.x=-50
bgaragedoor1Cube.position.y=18
bgaragedoor1Cube.position.z=170

//first base//
let chousefirstbase1Geometry = new THREE.BoxBufferGeometry(70,120,80)
let chousefirstbase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide})
];
let chousefirstbase1Materials = new THREE.MeshFaceMaterial(chousefirstbase1Texture);
let chousefirstbase1Cube = new THREE.Mesh(chousefirstbase1Geometry, chousefirstbase1Materials);
this._scene.add(chousefirstbase1Cube);
chousefirstbase1Cube.position.x=-200
chousefirstbase1Cube.position.y=25
chousefirstbase1Cube.position.z=100
//second base//
let chousesecondbase1Geometry = new THREE.BoxBufferGeometry(70,80,80)
let chousesecondbase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide})
];
let chousesecondbase1Materials = new THREE.MeshFaceMaterial(chousesecondbase1Texture);
let chousesecondbase1Cube = new THREE.Mesh(chousesecondbase1Geometry, chousesecondbase1Materials);
this._scene.add(chousesecondbase1Cube);
chousesecondbase1Cube.position.x=-200
chousesecondbase1Cube.position.y=25
chousesecondbase1Cube.position.z=20
//third base//
let chousethirdbase1Geometry = new THREE.BoxBufferGeometry(70,120,80)
let chousethirdbase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house4Texture.jpg'), side: THREE.DoubleSide})
];
let chousethirdbase1Materials = new THREE.MeshFaceMaterial(chousethirdbase1Texture);
let chousethirdbase1Cube = new THREE.Mesh(chousethirdbase1Geometry, chousethirdbase1Materials);
this._scene.add(chousethirdbase1Cube);
chousethirdbase1Cube.position.x=-200
chousethirdbase1Cube.position.y=25
chousethirdbase1Cube.position.z=-60
//roof 1//
let chouseroof1Geometry = new THREE.BoxBufferGeometry(100,8,100)
let chouseroof1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide})
];
let chouseroof1Materials = new THREE.MeshFaceMaterial(chouseroof1Texture);
let chouseroof1Cube = new THREE.Mesh(chouseroof1Geometry, chouseroof1Materials);
this._scene.add(chouseroof1Cube);
chouseroof1Cube.position.x=-200
chouseroof1Cube.position.y=80
chouseroof1Cube.position.z=-60


//roof 2//
let chouseroof2Geometry = new THREE.BoxBufferGeometry(100,8,100)
let chouseroof2Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof3.jpg'), side: THREE.DoubleSide})
];
let chouseroof2Materials = new THREE.MeshFaceMaterial(chouseroof2Texture);
let chouseroof2Cube = new THREE.Mesh(chouseroof2Geometry, chouseroof2Materials);
this._scene.add(chouseroof2Cube);
chouseroof2Cube.position.x=-200
chouseroof2Cube.position.y=80
chouseroof2Cube.position.z=100

//Door//
let chousedoor1Geometry = new THREE.BoxBufferGeometry(5,50,20)
let chousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door4Texture.jpg'), side: THREE.DoubleSide});
let chousedoor1Cube = new THREE.Mesh(chousedoor1Geometry, chousedoor1Materials);
this._scene.add(chousedoor1Cube);
chousedoor1Cube.position.x=-165
chousedoor1Cube.position.y=5
chousedoor1Cube.position.z=20
//Window 1//
let chousewindow1Geometry = new THREE.BoxBufferGeometry(10,130,70)
let chousewindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window2.jpg'), side: THREE.DoubleSide});
let chousewindow1Cube = new THREE.Mesh(chousewindow1Geometry, chousewindow1Materials);
this._scene.add(chousewindow1Cube);
chousewindow1Cube.position.x=-169
chousewindow1Cube.position.y=5
chousewindow1Cube.position.z=-60
//Window 2//
let chousewindow2Geometry = new THREE.BoxBufferGeometry(10,130,70)
let chousewindow2Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window2.jpg'), side: THREE.DoubleSide});
let chousewindow2Cube = new THREE.Mesh(chousewindow2Geometry, chousewindow2Materials);
this._scene.add(chousewindow2Cube);
chousewindow2Cube.position.x=-169
chousewindow2Cube.position.y=5
chousewindow2Cube.position.z=100


///Building D - 1///
//base//
let dhousebase1Geometry = new THREE.BoxBufferGeometry(60,60,60)
let dhousebase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house2Texture.jpg'), side: THREE.DoubleSide})
];
let dhousebase1Materials = new THREE.MeshFaceMaterial(dhousebase1Texture);
let dhousebase1Cube = new THREE.Mesh(dhousebase1Geometry, dhousebase1Materials);
this._scene.add(dhousebase1Cube);
dhousebase1Cube.position.x=130
dhousebase1Cube.position.y=30
dhousebase1Cube.position.z=200
//roof//
let dhouseroof1Geometry = new THREE.CylinderBufferGeometry(10,50,30)
let dhouseroof1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof2Texture.jpg'), side: THREE.DoubleSide})
];
let dhouseroof1Materials = new THREE.MeshFaceMaterial(dhouseroof1Texture);
let dhouseroof1Cylinder = new THREE.Mesh(dhouseroof1Geometry, dhouseroof1Materials);
this._scene.add(dhouseroof1Cylinder);
dhouseroof1Cylinder.position.x=130
dhouseroof1Cylinder.position.y=70
dhouseroof1Cylinder.position.z=200
//door//
let dhousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let dhousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door2Texture.jpg'), side: THREE.DoubleSide});
let dhousedoor1Cube = new THREE.Mesh(dhousedoor1Geometry, dhousedoor1Materials);
this._scene.add(dhousedoor1Cube);
dhousedoor1Cube.position.x=130
dhousedoor1Cube.position.y=10
dhousedoor1Cube.position.z=170
//first window //
let dfirstwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let dfirstwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/roadTexture.jpg'), side: THREE.DoubleSide});
let dfirstwindow1Cube = new THREE.Mesh(dfirstwindow1Geometry, dfirstwindow1Materials);
this._scene.add(dfirstwindow1Cube);
dfirstwindow1Cube.position.x=150
dfirstwindow1Cube.position.y=20
dfirstwindow1Cube.position.z=170
//second window//
let dsecondwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let dsecondwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/roadTexture.jpg'), side: THREE.DoubleSide});
let dsecondwindow1Cube = new THREE.Mesh(dsecondwindow1Geometry, dsecondwindow1Materials);
this._scene.add(dsecondwindow1Cube);
dsecondwindow1Cube.position.x=110
dsecondwindow1Cube.position.y=20
dsecondwindow1Cube.position.z=170

/////////////////ROAD//////////////
let roadGeometry = new THREE.BoxBufferGeometry(70,5,170)
let roadTexture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roadTexture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide})
];
let roadMaterials = new THREE.MeshFaceMaterial(roadTexture);
let roadCube = new THREE.Mesh(roadGeometry, roadMaterials);
this._scene.add(roadCube);
roadCube.position.x=15
roadCube.position.y=-2.01
roadCube.position.z=-170


///////////////DEAD-END////////////
let deadendGeometry = new THREE.CircleBufferGeometry(160,32)
let deadendMaterial = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/roadTexture.jpg'), side: THREE.DoubleSide});
let deadendCube = new THREE.Mesh(deadendGeometry, deadendMaterial);
this._scene.add(deadendCube);
deadendCube.position.x=15
deadendCube.position.y=0.3
deadendCube.position.z=-20
deadendCube.rotation.x=4.70

///////////////CONCRETE////////////
//Concrete 1//
let concrete1Geometry = new THREE.BoxBufferGeometry(400,5,90)
let concrete1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/concreteTexture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide})
];
let concrete1Materials = new THREE.MeshFaceMaterial(concrete1Texture);
let concrete1Cube = new THREE.Mesh(concrete1Geometry, concrete1Materials);
this._scene.add(concrete1Cube);
concrete1Cube.position.x=15
concrete1Cube.position.y=-2
concrete1Cube.position.z=200
//Concrete 2//
let concrete2Geometry = new THREE.BoxBufferGeometry(90,5,370)
let concrete2Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/concreteTexture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide})
];
let concrete2Materials = new THREE.MeshFaceMaterial(concrete2Texture);
let concrete2Cube = new THREE.Mesh(concrete2Geometry, concrete2Materials);
this._scene.add(concrete2Cube);
concrete2Cube.position.x=-200
concrete2Cube.position.y=-2
concrete2Cube.position.z=80


//Tree 1//
let tree1Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree1Mesh = new THREE.Mesh(tree1Geometry, tree1Material);
this._scene.add(tree1Mesh);
tree1Mesh.position.x = 200
tree1Mesh.position.y = 15
tree1Mesh.position.z = 100

let top1Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top1Mesh = new THREE.Mesh(top1Geometry, top1Material);
this._scene.add(top1Mesh);

top1Mesh.position.x = 200
top1Mesh.position.y = 40
top1Mesh.position.z = 100
//Tree 2//
let tree2Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree2Mesh = new THREE.Mesh(tree2Geometry, tree2Material);
this._scene.add(tree2Mesh);
tree2Mesh.position.x = 200
tree2Mesh.position.y = 15
tree2Mesh.position.z = 65

let top2Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top2Mesh = new THREE.Mesh(top2Geometry, top2Material);
this._scene.add(top2Mesh);

top2Mesh.position.x = 200
top2Mesh.position.y = 40
top2Mesh.position.z = 65
//Tree 3//
let tree3Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree3Mesh = new THREE.Mesh(tree3Geometry, tree3Material);
this._scene.add(tree3Mesh);
tree3Mesh.position.x = 200
tree3Mesh.position.y = 15
tree3Mesh.position.z = 30

let top3Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top3Mesh = new THREE.Mesh(top3Geometry, top3Material);
this._scene.add(top3Mesh);

top3Mesh.position.x = 200
top3Mesh.position.y = 40
top3Mesh.position.z = 30
//Tree 4//
let tree4Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree4Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree4Mesh = new THREE.Mesh(tree4Geometry, tree4Material);
this._scene.add(tree4Mesh);
tree4Mesh.position.x = 200
tree4Mesh.position.y = 15
tree4Mesh.position.z = -5

let top4Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top4Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top4Mesh = new THREE.Mesh(top4Geometry, top4Material);
this._scene.add(top4Mesh);

top4Mesh.position.x = 200
top4Mesh.position.y = 40
top4Mesh.position.z = -5
//Tree 5//
let tree5Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree5Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree5Mesh = new THREE.Mesh(tree5Geometry, tree5Material);
this._scene.add(tree5Mesh);
tree5Mesh.position.x = 200
tree5Mesh.position.y = 15
tree5Mesh.position.z = -40

let top5Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top5Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top5Mesh = new THREE.Mesh(top5Geometry, top5Material);
this._scene.add(top5Mesh);

top5Mesh.position.x = 200
top5Mesh.position.y = 40
top5Mesh.position.z = -40
//Tree 6//
let tree6Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree6Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree6Mesh = new THREE.Mesh(tree6Geometry, tree6Material);
this._scene.add(tree6Mesh);
tree6Mesh.position.x = 200
tree6Mesh.position.y = 15
tree6Mesh.position.z = -75

let top6Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top6Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top6Mesh = new THREE.Mesh(top6Geometry, top6Material);
this._scene.add(top6Mesh);

top6Mesh.position.x = 200
top6Mesh.position.y = 40
top6Mesh.position.z = -75
//Tree 7//
let tree7Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree7Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree7Mesh = new THREE.Mesh(tree7Geometry, tree7Material);
this._scene.add(tree7Mesh);
tree7Mesh.position.x = 200
tree7Mesh.position.y = 15
tree7Mesh.position.z = -110

let top7Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top7Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top7Mesh = new THREE.Mesh(top7Geometry, top7Material);
this._scene.add(top7Mesh);

top7Mesh.position.x = 200
top7Mesh.position.y = 40
top7Mesh.position.z = -110
//Tree 8//
let tree8Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree8Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree8Mesh = new THREE.Mesh(tree7Geometry, tree7Material);
this._scene.add(tree8Mesh);
tree8Mesh.position.x = 165
tree8Mesh.position.y = 15
tree8Mesh.position.z = -110

let top8Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top8Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top8Mesh = new THREE.Mesh(top8Geometry, top8Material);
this._scene.add(top8Mesh);

top8Mesh.position.x = 165
top8Mesh.position.y = 40
top8Mesh.position.z = -110
//Tree 9//
let tree9Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree9Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree9Mesh = new THREE.Mesh(tree9Geometry, tree9Material);
this._scene.add(tree9Mesh);
tree9Mesh.position.x = 130
tree9Mesh.position.y = 15
tree9Mesh.position.z = -110

let top9Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top9Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top9Mesh = new THREE.Mesh(top9Geometry, top9Material);
this._scene.add(top9Mesh);

top9Mesh.position.x = 130
top9Mesh.position.y = 40
top9Mesh.position.z = -110
//Tree 10//
let tree10Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree10Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree10Mesh = new THREE.Mesh(tree10Geometry, tree10Material);
this._scene.add(tree10Mesh);
tree10Mesh.position.x = 95
tree10Mesh.position.y = 15
tree10Mesh.position.z = -110

let top10Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top10Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top10Mesh = new THREE.Mesh(top10Geometry, top10Material);
this._scene.add(top10Mesh);

top10Mesh.position.x = 95
top10Mesh.position.y = 40
top10Mesh.position.z = -110
//Tree 11//
let tree11Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree11Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree11Mesh = new THREE.Mesh(tree11Geometry, tree11Material);
this._scene.add(tree11Mesh);
tree11Mesh.position.x = 60
tree11Mesh.position.y = 15
tree11Mesh.position.z = -110

let top11Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top11Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top11Mesh = new THREE.Mesh(top11Geometry, top11Material);
this._scene.add(top11Mesh);

top11Mesh.position.x = 60
top11Mesh.position.y = 40
top11Mesh.position.z = -110


////electric pole////
//polebase//
let polebaseGeometry = new THREE.CylinderGeometry( 2, 2, 150, 32);
let polebaseMaterial = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/electricpostTexture.jpg'), side: THREE.DoubleSide} );
let polebaseMesh = new THREE.Mesh(polebaseGeometry, polebaseMaterial );
this._scene.add( polebaseMesh );
polebaseMesh.position.x = -40
polebaseMesh.position.y = 0
polebaseMesh.position.z = -100
//lamp line 1//
let lampline1Geometry = new THREE.CubeGeometry( 3, 2, 20);
let lampline1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/lamplineTexture.jpg'), side: THREE.DoubleSide} );
let lampline1Mesh = new THREE.Mesh(lampline1Geometry, lampline1Material );
this._scene.add( lampline1Mesh );
lampline1Mesh.position.x = -38
lampline1Mesh.position.y = 70
lampline1Mesh.position.z = -105
lampline1Mesh.rotation.y= 160.3
//pole pig//
let polepigGeometry = new THREE.CylinderGeometry( 5, 5, 10, 32);
let polepigMaterial = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/polepigTexture.jpg'), side: THREE.DoubleSide} );
let polepigMesh = new THREE.Mesh(polepigGeometry, polepigMaterial );
this._scene.add( polepigMesh );
polepigMesh.position.x = -40
polepigMesh.position.y = 60
polepigMesh.position.z = -105
//pole platform//
let poleplatformGeometry = new THREE.CylinderGeometry( 4, 4, 10, 32);
let poleplatformMaterial = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/cementTexture.jpg'), side: THREE.DoubleSide} );
let poleplatformMesh = new THREE.Mesh(poleplatformGeometry, poleplatformMaterial );
this._scene.add( poleplatformMesh );
poleplatformMesh.position.x = -40
poleplatformMesh.position.y = 0
poleplatformMesh.position.z = -100
//wire 1//
let wire1Geometry =  new THREE.CubeGeometry( 0.5,0.5, 200);
let wire1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/cementTexture.jpg'), side: THREE.DoubleSide} );
let wire1Mesh = new THREE.Mesh(wire1Geometry, wire1Material );
this._scene.add( wire1Mesh );
wire1Mesh.position.x = -38
wire1Mesh.position.y = 70
wire1Mesh.position.z = -200
//wire 2//
let wire2Geometry =  new THREE.CubeGeometry( 0.5,0.5, 200);
let wire2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/cementTexture.jpg'), side: THREE.DoubleSide} );
let wire2Mesh = new THREE.Mesh(wire2Geometry, wire2Material );
this._scene.add( wire2Mesh );
wire2Mesh.position.x = -140
wire2Mesh.position.y = 70
wire2Mesh.position.z = -100
wire2Mesh.rotation.y= 240.4

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

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/posx.jpg',
        './resources/negx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posz.jpg',
        './resources/negz.jpg',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = texture;

    

//Background   
let bgGeometry = new THREE.BoxBufferGeometry(500,300,500);
let bgGround = 
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/front.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/back.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/up.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/down.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/right.png'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/left.png'), side: THREE.DoubleSide})

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
