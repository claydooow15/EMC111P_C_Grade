import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
//import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
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
    const loader = new FBXLoader();
    //add character here
    loader.setPath('./resources/zombie/');
    loader.load('breathidle.fbx', (fbx) => {
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

      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/zombie/');
      loader.load('newwalk.fbx', (a) => { _OnLoad('walk', a); });
      loader.load('run.fbx', (a) => { _OnLoad('run', a); });
      loader.load('breathidle.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('kneel.fbx', (a) => { _OnLoad('dance', a); });
    });
/*    
    const loader1 = new FBXLoader();
    loader1.setPath('./resources/zombie/');
    loader1.load('desbian.fbx', (fbx) => {
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
    });*/
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
        //this._keys.left = true;
        break;
      case 83: // s
        //this._keys.backward = true;
        break;
      case 68: // d
        //this._keys.right = true;
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
        //this._camera.position.set(80, 35, 30); //new camera position
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
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide})
];
let ahousebase1Materials = new THREE.MeshFaceMaterial(ahousebase1Texture);
let ahousebase1Cube = new THREE.Mesh(ahousebase1Geometry, ahousebase1Materials);
this._scene.add(ahousebase1Cube);
ahousebase1Cube.position.x=15
ahousebase1Cube.position.y=30
ahousebase1Cube.position.z=200
//roof//
let ahouseroof1Geometry = new THREE.CylinderBufferGeometry(10,50,30)
let ahouseroof1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/woodenHouse_Texture.jpg'), side: THREE.DoubleSide})
];
let ahouseroof1Materials = new THREE.MeshFaceMaterial(ahouseroof1Texture);
let ahouseroof1Cylinder = new THREE.Mesh(ahouseroof1Geometry, ahouseroof1Materials);
this._scene.add(ahouseroof1Cylinder);
ahouseroof1Cylinder.position.x=15
ahouseroof1Cylinder.position.y=70
ahouseroof1Cylinder.position.z=200
//door//
let ahousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let ahousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door1Texture.jpg'), side: THREE.DoubleSide});
let ahousedoor1Cube = new THREE.Mesh(ahousedoor1Geometry, ahousedoor1Materials);
this._scene.add(ahousedoor1Cube);
ahousedoor1Cube.position.x=15
ahousedoor1Cube.position.y=10
ahousedoor1Cube.position.z=170
//first window //
let afirstwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let afirstwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let afirstwindow1Cube = new THREE.Mesh(afirstwindow1Geometry, afirstwindow1Materials);
this._scene.add(afirstwindow1Cube);
afirstwindow1Cube.position.x=-5
afirstwindow1Cube.position.y=20
afirstwindow1Cube.position.z=170
//second window//
let asecondwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let asecondwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let asecondwindow1Cube = new THREE.Mesh(asecondwindow1Geometry, asecondwindow1Materials);
this._scene.add(asecondwindow1Cube);
asecondwindow1Cube.position.x=35
asecondwindow1Cube.position.y=20
asecondwindow1Cube.position.z=170

///Building D - 1///
//base//
let dhousebase1Geometry = new THREE.BoxBufferGeometry(60,60,60)
let dhousebase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide})
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
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/hayHouse_Texture.jpg'), side: THREE.DoubleSide})
];
let dhouseroof1Materials = new THREE.MeshFaceMaterial(dhouseroof1Texture);
let dhouseroof1Cylinder = new THREE.Mesh(dhouseroof1Geometry, dhouseroof1Materials);
this._scene.add(dhouseroof1Cylinder);
dhouseroof1Cylinder.position.x=130
dhouseroof1Cylinder.position.y=70
dhouseroof1Cylinder.position.z=200
//door//
let dhousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let dhousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/hayDoor_Texture.jpg'), side: THREE.DoubleSide});
let dhousedoor1Cube = new THREE.Mesh(dhousedoor1Geometry, dhousedoor1Materials);
this._scene.add(dhousedoor1Cube);
dhousedoor1Cube.position.x=130
dhousedoor1Cube.position.y=10
dhousedoor1Cube.position.z=170
//first window //
let dfirstwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let dfirstwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/hayWindow_Texture.jpg'), side: THREE.DoubleSide});
let dfirstwindow1Cube = new THREE.Mesh(dfirstwindow1Geometry, dfirstwindow1Materials);
this._scene.add(dfirstwindow1Cube);
dfirstwindow1Cube.position.x=150
dfirstwindow1Cube.position.y=20
dfirstwindow1Cube.position.z=170
//second window//
let dsecondwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let dsecondwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/hayWindow_Texture.jpg'), side: THREE.DoubleSide});
let dsecondwindow1Cube = new THREE.Mesh(dsecondwindow1Geometry, dsecondwindow1Materials);
this._scene.add(dsecondwindow1Cube);
dsecondwindow1Cube.position.x=110
dsecondwindow1Cube.position.y=20
dsecondwindow1Cube.position.z=170

///Building B - 1///
//base//
let bhousebase1Geometry = new THREE.BoxBufferGeometry(60,60,60)
let bhousebase1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide})
];
let bhousebase1Materials = new THREE.MeshFaceMaterial(bhousebase1Texture);
let bhousebase1Cube = new THREE.Mesh(bhousebase1Geometry, bhousebase1Materials);
this._scene.add(bhousebase1Cube);
bhousebase1Cube.position.x=-90
bhousebase1Cube.position.y=30
bhousebase1Cube.position.z=200
//roof//
let bhouseroof1Geometry = new THREE.CylinderBufferGeometry(10,50,30)
let bhouseroof1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/roof1Texture.jpg'), side: THREE.DoubleSide})
];
let bhouseroof1Materials = new THREE.MeshFaceMaterial(bhouseroof1Texture);
let bhouseroof1Cylinder = new THREE.Mesh(bhouseroof1Geometry, bhouseroof1Materials);
this._scene.add(bhouseroof1Cylinder);
bhouseroof1Cylinder.position.x=-90
bhouseroof1Cylinder.position.y=70
bhouseroof1Cylinder.position.z=200
//door//
let bhousedoor1Geometry = new THREE.BoxBufferGeometry(20,50,5)
let bhousedoor1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/door2Texture.jpg'), side: THREE.DoubleSide});
let bhousedoor1Cube = new THREE.Mesh(bhousedoor1Geometry, bhousedoor1Materials);
this._scene.add(bhousedoor1Cube);
bhousedoor1Cube.position.x=-90
bhousedoor1Cube.position.y=10
bhousedoor1Cube.position.z=170
//first window //
let bfirstwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let bfirstwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let bfirstwindow1Cube = new THREE.Mesh(bfirstwindow1Geometry, bfirstwindow1Materials);
this._scene.add(bfirstwindow1Cube);
bfirstwindow1Cube.position.x=-110
bfirstwindow1Cube.position.y=20
bfirstwindow1Cube.position.z=170

//second window//
let bsecondwindow1Geometry = new THREE.BoxBufferGeometry(10,20,5)
let bsecondwindow1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/window1.jpg'), side: THREE.DoubleSide});
let bsecondwindow1Cube = new THREE.Mesh(bsecondwindow1Geometry, bsecondwindow1Materials);
this._scene.add(bsecondwindow1Cube);
bsecondwindow1Cube.position.x=-70
bsecondwindow1Cube.position.y=20
bsecondwindow1Cube.position.z=170

//Chimney
let bsecondChimneyGeometry = new THREE.BoxBufferGeometry(28,35,8)
let bsecondChimneyMaterials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/house1Texture.jpg'), side: THREE.DoubleSide});
let bsecondChimneyCube = new THREE.Mesh(bsecondChimneyGeometry, bsecondChimneyMaterials);
this._scene.add(bsecondChimneyCube);
bsecondChimneyCube.position.x=-90
bsecondChimneyCube.position.y=40
bsecondChimneyCube.position.z=225

//Pot
let potGeometry = new THREE.SphereGeometry(9,20,20)
let potMaterials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let potSphere = new THREE.Mesh(potGeometry, potMaterials);
this._scene.add(potSphere);
potSphere.position.x=-90
potSphere.position.y=8
potSphere.position.z=225


//pot lid
let potLidGeometry = new THREE.BoxBufferGeometry(13,2,8)
let potLidMaterials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let potLidCube = new THREE.Mesh(potLidGeometry, potLidMaterials);
this._scene.add(potLidCube);
potLidCube.position.x=-90
potLidCube.position.y=17
potLidCube.position.z=225


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
//Tree 12//
let tree12Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree12Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree12Mesh = new THREE.Mesh(tree12Geometry, tree12Material);
this._scene.add(tree12Mesh);
tree12Mesh.position.x = 25
tree12Mesh.position.y = 15
tree12Mesh.position.z = -110

let top12Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top12Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top12Mesh = new THREE.Mesh(top12Geometry, top12Material);
this._scene.add(top12Mesh);

top12Mesh.position.x = 25
top12Mesh.position.y = 40
top12Mesh.position.z = -110
//Tree 13//
let tree13Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree13Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree13Mesh = new THREE.Mesh(tree13Geometry, tree13Material);
this._scene.add(tree13Mesh);
tree13Mesh.position.x = -10
tree13Mesh.position.y = 15
tree13Mesh.position.z = -110

let top13Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top13Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top13Mesh = new THREE.Mesh(top13Geometry, top13Material);
this._scene.add(top13Mesh);

top13Mesh.position.x = -10
top13Mesh.position.y = 40
top13Mesh.position.z = -110
//Tree 14//
let tree14Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree14Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree14Mesh = new THREE.Mesh(tree14Geometry, tree14Material);
this._scene.add(tree14Mesh);
tree14Mesh.position.x = -45
tree14Mesh.position.y = 15
tree14Mesh.position.z = -110

let top14Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top14Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top14Mesh = new THREE.Mesh(top14Geometry, top14Material);
this._scene.add(top14Mesh);

top14Mesh.position.x = -45
top14Mesh.position.y = 40
top14Mesh.position.z = -110
//Tree 15//
let tree15Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree15Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree15Mesh = new THREE.Mesh(tree15Geometry, tree15Material);
this._scene.add(tree15Mesh);
tree15Mesh.position.x = -80
tree15Mesh.position.y = 15
tree15Mesh.position.z = -110

let top15Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top15Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top15Mesh = new THREE.Mesh(top15Geometry, top15Material);
this._scene.add(top15Mesh);

top15Mesh.position.x = -80
top15Mesh.position.y = 40
top15Mesh.position.z = -110
//Tree 16//
let tree16Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree16Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree16Mesh = new THREE.Mesh(tree16Geometry, tree16Material);
this._scene.add(tree16Mesh);
tree16Mesh.position.x = -115
tree16Mesh.position.y = 15
tree16Mesh.position.z = -110

let top16Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top16Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top16Mesh = new THREE.Mesh(top16Geometry, top16Material);
this._scene.add(top16Mesh);

top16Mesh.position.x = -115
top16Mesh.position.y = 40
top16Mesh.position.z = -110
//Tree 17//
let tree17Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree17Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree17Mesh = new THREE.Mesh(tree17Geometry, tree17Material);
this._scene.add(tree17Mesh);
tree17Mesh.position.x = -150
tree17Mesh.position.y = 15
tree17Mesh.position.z = -110

let top17Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top17Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top17Mesh = new THREE.Mesh(top17Geometry, top17Material);
this._scene.add(top17Mesh);

top17Mesh.position.x = -150
top17Mesh.position.y = 40
top17Mesh.position.z = -110
//Tree 18//
let tree18Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree18Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree18Mesh = new THREE.Mesh(tree18Geometry, tree18Material);
this._scene.add(tree18Mesh);
tree18Mesh.position.x = -150
tree18Mesh.position.y = 15
tree18Mesh.position.z = -75

let top18Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top18Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top18Mesh = new THREE.Mesh(top18Geometry, top18Material);
this._scene.add(top18Mesh);

top18Mesh.position.x = -150
top18Mesh.position.y = 40
top18Mesh.position.z = -75
//Tree 19//
let tree19Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree19Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree19Mesh = new THREE.Mesh(tree19Geometry, tree19Material);
this._scene.add(tree19Mesh);
tree19Mesh.position.x = -150
tree19Mesh.position.y = 15
tree19Mesh.position.z = -40

let top19Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top19Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top19Mesh = new THREE.Mesh(top19Geometry, top19Material);
this._scene.add(top19Mesh);

top19Mesh.position.x = -150
top19Mesh.position.y = 40
top19Mesh.position.z = -40

//Tree 20//
let tree20Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree20Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree20Mesh = new THREE.Mesh(tree20Geometry, tree20Material);
this._scene.add(tree20Mesh);
tree20Mesh.position.x = -150
tree20Mesh.position.y = 15
tree20Mesh.position.z = -5

let top20Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top20Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top20Mesh = new THREE.Mesh(top20Geometry, top20Material);
this._scene.add(top20Mesh);

top20Mesh.position.x = -150
top20Mesh.position.y = 40
top20Mesh.position.z = -5

//Tree 21//
let tree21Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree21Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree21Mesh = new THREE.Mesh(tree21Geometry, tree21Material);
this._scene.add(tree21Mesh);
tree21Mesh.position.x = -150
tree21Mesh.position.y = 15
tree21Mesh.position.z = 30

let top21Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top21Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top21Mesh = new THREE.Mesh(top21Geometry, top21Material);
this._scene.add(top21Mesh);

top21Mesh.position.x = -150
top21Mesh.position.y = 40
top21Mesh.position.z = 30

//Tree 22//
let tree22Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree22Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree22Mesh = new THREE.Mesh(tree22Geometry, tree22Material);
this._scene.add(tree22Mesh);
tree22Mesh.position.x = -150
tree22Mesh.position.y = 15
tree22Mesh.position.z = 65

let top22Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top22Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top22Mesh = new THREE.Mesh(top22Geometry, top22Material);
this._scene.add(top22Mesh);

top22Mesh.position.x = -150
top22Mesh.position.y = 40
top22Mesh.position.z = 65
//Tree 23//
let tree23Geometry = new THREE.CylinderGeometry(3.5,5,40,32);
let tree23Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treeTexture.jpg'), side: THREE.DoubleSide} );
let tree23Mesh = new THREE.Mesh(tree23Geometry, tree23Material);
this._scene.add(tree23Mesh);
tree23Mesh.position.x = -150
tree23Mesh.position.y = 15
tree23Mesh.position.z = 100

let top23Geometry = new THREE.CylinderGeometry(0.10,15 , 55, 32, 64);
let top23Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/treetopTexture.jpg'), side: THREE.DoubleSide});
let top23Mesh = new THREE.Mesh(top23Geometry, top23Material);
this._scene.add(top23Mesh);

top23Mesh.position.x = -150
top23Mesh.position.y = 40
top23Mesh.position.z = 100

/////////////Characters////////
//Pig 1 (Mid)//
//Body//
let pigbody1Geometry = new THREE.SphereGeometry(9, 20, 20);
let pigbody1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pigbody1Mesh = new THREE.Mesh(pigbody1Geometry, pigbody1Material);
this._scene.add(pigbody1Mesh);


pigbody1Mesh.position.x=18
pigbody1Mesh.position.y=10
pigbody1Mesh.position.z=120
//Leg Back Right//
let piglbr1Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbr1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbr1Mesh = new THREE.Mesh(piglbr1Geometry, piglbr1Material);
this._scene.add(piglbr1Mesh);
piglbr1Mesh.position.x = 21
piglbr1Mesh.position.y = 2
piglbr1Mesh.position.z = 125
//Leg Back Left//
let piglbl1Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbl1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbl1Mesh = new THREE.Mesh(piglbl1Geometry, piglbl1Material);
this._scene.add(piglbl1Mesh);
piglbl1Mesh.position.x = 16
piglbl1Mesh.position.y = 2
piglbl1Mesh.position.z = 125
//Leg Front Left//
let piglfl1Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfl1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfl1Mesh = new THREE.Mesh(piglfl1Geometry, piglfl1Material);
this._scene.add(piglfl1Mesh);
piglfl1Mesh.position.x = 16
piglfl1Mesh.position.y = 2
piglfl1Mesh.position.z = 115
//Leg Front Right//
let piglfr1Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfr1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfr1Mesh = new THREE.Mesh(piglfr1Geometry, piglfr1Material);
this._scene.add(piglfr1Mesh);
piglfr1Mesh.position.x = 21
piglfr1Mesh.position.y = 2
piglfr1Mesh.position.z = 115
//Head//
let pighead1Geometry = new THREE.SphereGeometry(4, 20, 20);
let pighead1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pighead1Mesh = new THREE.Mesh(pighead1Geometry, pighead1Material);
this._scene.add(pighead1Mesh);

pighead1Mesh.position.x = 18
pighead1Mesh.position.y = 10
pighead1Mesh.position.z = 109
//Nose//
let pignose1Geometry = new THREE.SphereGeometry(1, 20, 20);
let pignose1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pignose1Mesh = new THREE.Mesh(pignose1Geometry, pignose1Material);
this._scene.add(pignose1Mesh);

pignose1Mesh.position.x = 18
pignose1Mesh.position.y = 10
pignose1Mesh.position.z = 105
//Eyes Left//
let pigeyesl1Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesl1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesl1Mesh = new THREE.Mesh(pigeyesl1Geometry, pigeyesl1Material);
this._scene.add(pigeyesl1Mesh);

pigeyesl1Mesh.position.x = 16
pigeyesl1Mesh.position.y = 12
pigeyesl1Mesh.position.z = 106
//Eyes Right//
let pigeyesr1Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesr1Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesr1Mesh = new THREE.Mesh(pigeyesr1Geometry, pigeyesr1Material);
this._scene.add(pigeyesr1Mesh);

pigeyesr1Mesh.position.x = 20
pigeyesr1Mesh.position.y = 12
pigeyesr1Mesh.position.z = 106
//Mouth//
let pigmouth1Geometry = new THREE.BoxBufferGeometry(2,0.5,1)
let pigmouth1Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide})
];
let pigmouth1Materials = new THREE.MeshFaceMaterial(pigmouth1Texture);
let pigmouth1Cube = new THREE.Mesh(pigmouth1Geometry, pigmouth1Materials);
this._scene.add(pigmouth1Cube);
pigmouth1Cube.position.x=18
pigmouth1Cube.position.y=8
pigmouth1Cube.position.z=105.5

//Pig 2 (Left)//
//Body//
let pigbody2Geometry = new THREE.SphereGeometry(9,20,20)
let pigbody2Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide})
];
let pigbody2Materials = new THREE.MeshFaceMaterial(pigbody2Texture);
let pigbody2Cube = new THREE.Mesh(pigbody2Geometry, pigbody2Materials);
this._scene.add(pigbody2Cube);
pigbody2Cube.position.x=130
pigbody2Cube.position.y=9
pigbody2Cube.position.z=120
//Leg Back Right//
let piglbr2Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbr2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbr2Mesh = new THREE.Mesh(piglbr2Geometry, piglbr2Material);
this._scene.add(piglbr2Mesh);
piglbr2Mesh.position.x = 128
piglbr2Mesh.position.y = 2
piglbr2Mesh.position.z = 126
//Leg Back Left//
let piglbl2Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbl2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbl2Mesh = new THREE.Mesh(piglbl2Geometry, piglbl2Material);
this._scene.add(piglbl2Mesh);
piglbl2Mesh.position.x = 132
piglbl2Mesh.position.y = 2
piglbl2Mesh.position.z = 126
//Leg Front Left//
let piglfl2Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfl2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfl2Mesh = new THREE.Mesh(piglfl2Geometry, piglfl2Material);
this._scene.add(piglfl2Mesh);
piglfl2Mesh.position.x = 128
piglfl2Mesh.position.y = 2
piglfl2Mesh.position.z = 115
//Leg Front Right//
let piglfr2Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfr2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfr2Mesh = new THREE.Mesh(piglfr2Geometry, piglfr2Material);
this._scene.add(piglfr2Mesh);
piglfr2Mesh.position.x = 133
piglfr2Mesh.position.y = 2
piglfr2Mesh.position.z = 115
//Head//
let pighead2Geometry = new THREE.SphereGeometry(4, 20, 20);
let pighead2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pighead2Mesh = new THREE.Mesh(pighead2Geometry, pighead2Material);
this._scene.add(pighead2Mesh);

pighead2Mesh.position.x = 130
pighead2Mesh.position.y = 10
pighead2Mesh.position.z = 110
//Nose//
let pignose2Geometry = new THREE.SphereGeometry(1, 20, 20);
let pignose2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pignose2Mesh = new THREE.Mesh(pignose2Geometry, pignose2Material);
this._scene.add(pignose2Mesh);

pignose2Mesh.position.x = 130
pignose2Mesh.position.y = 10
pignose2Mesh.position.z = 106 
//Eyes Left//
let pigeyesl2Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesl2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesl2Mesh = new THREE.Mesh(pigeyesl2Geometry, pigeyesl2Material);
this._scene.add(pigeyesl2Mesh);

pigeyesl2Mesh.position.x = 128
pigeyesl2Mesh.position.y = 12
pigeyesl2Mesh.position.z = 107
//Eyes Right//
let pigeyesr2Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesr2Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesr2Mesh = new THREE.Mesh(pigeyesr2Geometry, pigeyesr2Material);
this._scene.add(pigeyesr2Mesh);

pigeyesr2Mesh.position.x = 132
pigeyesr2Mesh.position.y = 12
pigeyesr2Mesh.position.z = 107

//Mouth/
let pigmouth2Geometry = new THREE.BoxBufferGeometry(2,0.5,1)
let pigmouth2Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide})
];
let pigmouth2Materials = new THREE.MeshFaceMaterial(pigmouth2Texture);
let pigmouth2Cube = new THREE.Mesh(pigmouth2Geometry, pigmouth2Materials);
this._scene.add(pigmouth2Cube);

pigmouth2Cube.position.x=130
pigmouth2Cube.position.y=8
pigmouth2Cube.position.z=107


//Pig 3 (Right)//
//Body//
let pigbody3Geometry = new THREE.SphereGeometry(9,20,20)
let pigbody3Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide})
];
let pigbody3Materials = new THREE.MeshFaceMaterial(pigbody2Texture);
let pigbody3Cube = new THREE.Mesh(pigbody2Geometry, pigbody2Materials);
this._scene.add(pigbody3Cube);
pigbody3Cube.position.x=-90
pigbody3Cube.position.y=9
pigbody3Cube.position.z=120

//Leg Back Right//
let piglbr3Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbr3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbr3Mesh = new THREE.Mesh(piglbr3Geometry, piglbr3Material);
this._scene.add(piglbr3Mesh);
piglbr3Mesh.position.x = -91
piglbr3Mesh.position.y = 2
piglbr3Mesh.position.z = 125
//Leg Back Left//
let piglbl3Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglbl3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglbl3Mesh = new THREE.Mesh(piglbl3Geometry, piglbl3Material);
this._scene.add(piglbl3Mesh);
piglbl3Mesh.position.x = -87
piglbl3Mesh.position.y = 2
piglbl3Mesh.position.z = 125
//Leg Front Left//
let piglfl3Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfl3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfl3Mesh = new THREE.Mesh(piglfl3Geometry, piglfl3Material);
this._scene.add(piglfl3Mesh);
piglfl3Mesh.position.x = -87
piglfl3Mesh.position.y = 2
piglfl3Mesh.position.z = 115
//Leg Front Right//
let piglfr3Geometry = new THREE.CylinderGeometry(1,1,5,32);
let piglfr3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide} );
let piglfr3Mesh = new THREE.Mesh(piglfr3Geometry, piglfr3Material);
this._scene.add(piglfr3Mesh);
piglfr3Mesh.position.x = -93
piglfr3Mesh.position.y = 2
piglfr3Mesh.position.z = 115
//Head//
let pighead3Geometry = new THREE.SphereGeometry(4, 20, 20);
let pighead3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pighead3Mesh = new THREE.Mesh(pighead3Geometry, pighead3Material);
this._scene.add(pighead3Mesh);

pighead3Mesh.position.x = -90
pighead3Mesh.position.y = 10
pighead3Mesh.position.z = 109
//Nose//
let pignose3Geometry = new THREE.SphereGeometry(1, 20, 20);
let pignose3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/pinkPig.jpg'), side: THREE.DoubleSide});
let pignose3Mesh = new THREE.Mesh(pignose3Geometry, pignose3Material);
this._scene.add(pignose3Mesh);

pignose3Mesh.position.x = -90
pignose3Mesh.position.y = 10
pignose3Mesh.position.z = 105
//Eyes Left//
let pigeyesl3Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesl3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesl3Mesh = new THREE.Mesh(pigeyesl3Geometry, pigeyesl3Material);
this._scene.add(pigeyesl3Mesh);

pigeyesl3Mesh.position.x = -92
pigeyesl3Mesh.position.y = 12
pigeyesl3Mesh.position.z = 106
//Eyes Right//
let pigeyesr3Geometry = new THREE.SphereGeometry(0.5, 20, 20);
let pigeyesr3Material = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let pigeyesr3Mesh = new THREE.Mesh(pigeyesr3Geometry, pigeyesr3Material);
this._scene.add(pigeyesr3Mesh);

pigeyesr3Mesh.position.x = -88
pigeyesr3Mesh.position.y = 12
pigeyesr3Mesh.position.z = 106
//Mouth/
let pigmouth3Geometry = new THREE.BoxBufferGeometry(2,0.5,1)
let pigmouth3Texture =
[
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide}),
  new THREE.MeshBasicMaterial ({map: new THREE.TextureLoader().load('images/pigBody_Texture.jpg'), side: THREE.DoubleSide})
];
let pigmouth3Materials = new THREE.MeshFaceMaterial(pigmouth3Texture);
let pigmouth3Cube = new THREE.Mesh(pigmouth3Geometry, pigmouth3Materials);
this._scene.add(pigmouth3Cube);
pigmouth3Cube.position.x=-90
pigmouth3Cube.position.y=8
pigmouth3Cube.position.z=105.5

//Wolf

//body
let wolfBodyGeometry = new THREE.BoxBufferGeometry(11,15,8)
let wolfBodyMaterials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let wolfBodyCube = new THREE.Mesh(wolfBodyGeometry, wolfBodyMaterials);
this._scene.add(wolfBodyCube);
wolfBodyCube.position.x=110
wolfBodyCube.position.y=17
wolfBodyCube.position.z=25

//Left leg
let wolfL1Geometry = new THREE.BoxBufferGeometry(3.5,7,3.5)
let wolfL1Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let wolfL1Cube = new THREE.Mesh(wolfL1Geometry, wolfL1Materials);
this._scene.add(wolfL1Cube);
wolfL1Cube.position.x=113
wolfL1Cube.position.y=8
wolfL1Cube.position.z=25

//Right leg
let wolfL2Geometry = new THREE.BoxBufferGeometry(3.5,7,3.5)
let wolfL2Materials = new THREE.MeshLambertMaterial({map: new THREE.TextureLoader().load('images/backgroundTexture.jpg'), side: THREE.DoubleSide});
let wolfL2Cube = new THREE.Mesh(wolfL2Geometry, wolfL2Materials);
this._scene.add(wolfL2Cube);
wolfL2Cube.position.x=107
wolfL2Cube.position.y=8
wolfL2Cube.position.z=25

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

/*

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0x808080,
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);
*/
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
