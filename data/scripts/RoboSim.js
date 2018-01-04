// Global variable definition var canvas;
var canvas;
var gl;
var shaderProgram;

// Buffers
var worldVertexPositionBuffer = null;
var worldVertexTextureCoordBuffer = null;

// Model-view and projection matrix and model-view matrix stack
var mvMatrixStack = [];
var mvMatrix = mat4.create();
var pMatrix = mat4.create();

// Variables for storing textures
var wallTexture;

// Variable that stores  loading state of textures.
var texturesLoaded = false;

// Keyboard handling helper variable for reading the status of keys
var currentlyPressedKeys = {};

// Variables for storing current position and speed
var pitch = 0;
var pitchRate = 0;
var yaw = 0;
var yawRate = 0;
var xPosition = 0;
var yPosition = 2.0;
var zPosition = 0;
var speed = 0;
var sideSpeed = 0;
var hasShot = false;
// Used to make us "jog" up and down as we move forward.
var joggingAngle = 0;

//Game over variable
var intervalID;

//Robot (enemy) variables
var respawnTime = 300; // respawn values when robots die
var robotRespawnTimer = [150,99999999,99999999,99999999];
//var robotRespawnTimer = [150,1000,1500,1500]; // initial respawn values

var arrayRobots = [null,null,null,null];
function Robot(x,z) {
  this.xPosition = x;
  this.yPosition = 0; //vertical position (not needed) maybe ce bos rabu premaknt objekt gor al pa dol David
  this.zPosition = z;
  this.yaw = 0;
  this.speed = 0.01; //increase this if (too easy)
}

//Bullet variables
var existsBullet = null;
function Bullet(x,z,yaw) {
  this.xPosition = x;
  this.yPosition = 0.5;
  this.zPosition = z;
  this.yaw = yaw;
  this.speed = 0.05;
  this.lifeSpan = 30;
}

//HUD variables
var enemiesKilled = 0;
var ctx;
var hitIndicatorAlpha = 0.0;
var gameOver = false;

// Helper variable for animation
var lastTime = 0;

var models = {};
//
// Matrix utility functions
//
// mvPush   ... push current matrix on matrix stack
// mvPop    ... pop top matrix from stack
// degToRad ... convert degrees to radians
//
function mvPushMatrix() {
  var copy = mat4.create();
  mat4.set(mvMatrix, copy);
  mvMatrixStack.push(copy);
}

function mvPopMatrix() {
  if (mvMatrixStack.length == 0) {
    throw "Invalid popMatrix!";
  }
  mvMatrix = mvMatrixStack.pop();
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

//
// initGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initGL(canvas) {
  var gl = null;
  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch(e) {}

  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
  return gl;
}

//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader(gl, id) {
  var shaderScript = document.getElementById(id);

  // Didn't find an element with the specified ID; abort.
  if (!shaderScript) {
    return null;
  }
  
  // Walk through the source element's children, building the
  // shader source string.
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) {
        shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
  
  // Now figure out what type of shader script we have,
  // based on its MIME type.
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    console.log("Unknown shader type.");
    return null;  // Unknown shader type
  }

  // Send the source to the shader object
  gl.shaderSource(shader, shaderSource);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");
  
  // Create the shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program.");
  }
  
  // start using shading program for rendering
  gl.useProgram(shaderProgram);
  
  // store location of aVertexPosition variable defined in shader
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");

  // turn on vertex position attribute at specified position
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  // store location of aVertexNormal variable defined in shader
  shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");

  // store location of aTextureCoord variable defined in shader
  gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

  // store location of uPMatrix variable defined in shader - projection matrix 
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  // store location of uMVMatrix variable defined in shader - model-view matrix 
  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  // store location of uSampler variable defined in shader
  shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
  
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
  shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
  shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
  shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
  
}

//
// setMatrixUniforms
//
// Set the uniforms in shaders.
//
function setMatrixUniforms() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
  var normal = mat3.create();
  mat4.toInverseMat3(mvMatrix, normal);
  mat3.transpose(normal);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normal);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
  wallTexture = gl.createTexture();
  wallTexture.image = new Image();
  wallTexture.image.onload = function () {
    handleTextureLoaded(wallTexture)
  }
  wallTexture.image.src = "data/textures/wall.png";
}

function handleTextureLoaded(texture) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Third texture usus Linear interpolation approximation with nearest Mipmap selection
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);

  // when texture loading is finished we can draw scene.
  texturesLoaded = true;
}

//
// handleLoadedWorld
//
// Initialisation of world 
//
function handleLoadedWorld(data) {
  var lines = data.split("\n");
  var vertexCount = 0;
  var vertexPositions = [];
  var vertexTextureCoords = [];
  for (var i in lines) {
    var vals = lines[i].replace(/^\s+/, "").split(/\s+/);
    if (vals.length == 5 && vals[0] != "//") {
      // It is a line describing a vertex; get X, Y and Z first
      vertexPositions.push(parseFloat(vals[0]));
      vertexPositions.push(parseFloat(vals[1]));
      vertexPositions.push(parseFloat(vals[2]));

      // And then the texture coords
      vertexTextureCoords.push(parseFloat(vals[3]));
      vertexTextureCoords.push(parseFloat(vals[4]));

      vertexCount += 1;
    }
  }

  worldVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
  worldVertexPositionBuffer.itemSize = 3;
  worldVertexPositionBuffer.numItems = vertexCount;

  worldVertexTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexTextureCoords), gl.STATIC_DRAW);
  worldVertexTextureCoordBuffer.itemSize = 2;
  worldVertexTextureCoordBuffer.numItems = vertexCount;

  document.getElementById("loadingtext").textContent = "";
}

//
// loadWorld
//
// Loading world 
//
function loadWorld() {
  var request = new XMLHttpRequest();
  request.open("GET", "data/models/world.txt");
  request.onreadystatechange = function () {
    if (request.readyState == 4) {
      handleLoadedWorld(request.responseText);
    }
  }
  request.send();
}

var toLoad;
var loadedModels;
var loadedTextures;
function loadModels(path) {
  var request = new XMLHttpRequest();
  request.open("GET", path);
  request.onreadystatechange = function () {
    if (request.readyState == 4) {
      toLoad = request.responseText.split("\n");
      //console.log(toLoad[i]);
      var nrmodels=3; // increase if more models to be loaded
      loadedTextures=nrmodels;
      loadedModels=nrmodels;
      for(var i=0;i<nrmodels;i++) {
        models[i] = {};
      }
      for(var i=0;i<nrmodels;i++) {
        initTexture(i);
      }
      
      for(var i=0;i<nrmodels;i++) {
        initModel(i);
      }
    }
  }
  request.send();
}

function initTexture(i) {

  var name = (toLoad[i].split("."))[0];
  models[i].texture = gl.createTexture();
  models[i].texture.image = new Image();
  models[i].texture.image.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Third tmpTexture usus Linear interpolation approximation with nearest Mipmap selection
    gl.bindTexture(gl.TEXTURE_2D, models[i].texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, models[i].texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // when texture loading is finished we can draw scene.
    loadedTextures--;
  }
  models[i].texture.image.src = "data/textures/"+name+".png";
  
}


function initModel(countModels) {
  var request = new XMLHttpRequest();
  var oName = toLoad[countModels];
  request.open("GET", "data/models/"+oName);
  request.onreadystatechange = function () {
    if (request.readyState == 4) {
      console.log(countModels);
      var object = JSON.parse(request.responseText);
      models[countModels].vertices = new Float32Array(object.meshes[0].vertices);
      models[countModels].texCoords = object.meshes[0].texturecoords[0];
      
      models[countModels].vertexBufferObject = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, models[countModels].vertexBufferObject);
      gl.bufferData(gl.ARRAY_BUFFER, models[countModels].vertices, gl.STATIC_DRAW);
      models[countModels].vertexBufferObject.itemSize=3;
      models[countModels].vertexBufferObject.numItems=models[countModels].vertices.length/3;
      
      models[countModels].textureCoordVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, models[countModels].textureCoordVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models[countModels].texCoords), gl.STATIC_DRAW);
      models[countModels].textureCoordVertexBuffer.itemSize=2;
      models[countModels].textureCoordVertexBuffer.numItems=models[countModels].texCoords.length/2;
      
      var indices = [];
      for (var i = 0; i < object.meshes[0].faces.length; i++){
          indices.push.apply(indices,object.meshes[0].faces[i]);
      }
      
      models[countModels].indexBufferObject = gl.createBuffer();
      
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[countModels].indexBufferObject);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      models[countModels].indexBufferObject.itemSize = 1;
      models[countModels].indexBufferObject.numItems = indices.length;
      loadedModels--;
    }
  }
  request.send();
}


//
// drawScene
//
// Draw the scene.
//
var useLight = false;
function drawScene() {
  // set the rendering environment to full canvas size
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // If buffers are empty we stop loading the application.
  /*if (worldVertexTextureCoordBuffer == null || worldVertexPositionBuffer == null) {
    return;
  }*/
  // Establish the perspective with which we want to view the
  // scene. Our field of view is 60 degrees, with a width/height
  // ratio of 640:480, and we only want to see objects between 0.1 units
  // and 100 units away from the camera.
  mat4.perspective(60, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
  
  gl.uniform1i(shaderProgram.useLightingUniform, useLight);
  if (useLight) {
    // TO-DO
  }

  
  drawMap(); 
  drawRobots();
  drawBullets();
  /*
  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, wallTexture);
  gl.uniform1i(shaderProgram.samplerUniform, 0);

  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the cube.
  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLES, 0, worldVertexPositionBuffer.numItems);
  */
}

function drawBullets() {
  if(existsBullet != null) {
    //console.log("Drew robot");
    mat4.identity(mvMatrix);
    
    mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
    mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);

    //mat4.rotate(mvMatrix, degToRad(arrayRobots[i].yaw), [0, 0, 0]);
		mat4.translate(mvMatrix, [existsBullet.xPosition, 0, existsBullet.zPosition]);
		drawBullet();
  }
}
function drawBullet() {
  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, models[2].texture);
  gl.uniform1i(shaderProgram.samplerUniform, 0);

  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[2].textureCoordVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, models[2].textureCoordVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[2].vertexBufferObject);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[2].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[2].indexBufferObject);

  // Draw the cube.
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES,models[2].indexBufferObject.numItems, gl.UNSIGNED_SHORT, 0);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[2].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[2].indexBufferObject);
}

function drawRobots(){
  for(var i in arrayRobots){
    if(arrayRobots[i]){
      //console.log("Drew robot");
      mat4.identity(mvMatrix);
      
      mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
      mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);
      
      mat4.rotate(mvMatrix, degToRad(arrayRobots[i].yaw), [0, 0, 0]);
  		mat4.translate(mvMatrix, [arrayRobots[i].xPosition, 0, arrayRobots[i].zPosition]);
  		drawRobot();
    }
  }
}
function drawRobot(){
  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, models[1].texture);
  gl.uniform1i(shaderProgram.samplerUniform, 0);

  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[1].textureCoordVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, models[1].textureCoordVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[1].vertexBufferObject);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[1].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[1].indexBufferObject);

  // Draw the cube.
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES,models[1].indexBufferObject.numItems, gl.UNSIGNED_SHORT, 0);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[1].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[1].indexBufferObject);
}


function drawMap(){
  
  mat4.identity(mvMatrix);
  
  mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
  mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);

	mat4.rotate(mvMatrix,degToRad(-90), [1,0,0]);
	mat4.scale(mvMatrix, [12,12,12]);
	mat4.translate(mvMatrix, [0, 0, 0.9]);
  
  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, models[0].texture);
  gl.uniform1i(shaderProgram.samplerUniform, 0);

  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[0].textureCoordVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, models[0].textureCoordVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, models[0].vertexBufferObject);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[0].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[0].indexBufferObject);

  // Draw the cube.
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES,models[0].indexBufferObject.numItems, gl.UNSIGNED_SHORT, 0);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, models[0].vertexBufferObject.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models[0].indexBufferObject);

  /*
  // Draw the cube.
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES,models[0].indexBufferObject.numItems, gl.UNSIGNED_SHORT, 0);*/
}

//
// animate
//
// Called every time before redeawing the screen.
//
function animate() {
  var timeNow = new Date().getTime();
  if (lastTime != 0) {
    var elapsed = timeNow - lastTime;
    
    var xTmpSpeed = Math.sin(degToRad(yaw)) * speed * elapsed;
    var xTmpSideSpeed = Math.sin(degToRad(yaw-90)) * sideSpeed * elapsed;
    var zTmpSpeed = Math.cos(degToRad(yaw)) * speed * elapsed;
    var zTmpSideSpeed = Math.cos(degToRad(yaw-90)) * sideSpeed * elapsed;
    //create destroyed robots or notExisting ones
    repopulate();
    recalculateYawRobots();
    moveBullet(elapsed);
    checkIfShot();
    gameOverCheck();
    moveRobots();
    checkIfShot();
    gameOverCheck();
    hud();
    
    if (xPosition > 10) {
      xPosition = 0;
    }
    if (zPosition > 10) {
      zPosition = 0;
    }
    
    if (speed != 0 || sideSpeed != 0) {
      if (xPosition < 9.8 && xPosition > -9.8) {
        xPosition -= xTmpSpeed;
        xPosition -= xTmpSideSpeed;
        
        joggingAngle += elapsed * 0.6;
        yPosition = Math.sin(degToRad(joggingAngle)) / 20 + 1;
      } else if (xPosition < 9.9 && xTmpSpeed<0) {
        xPosition -= xTmpSpeed;
      } else if (xPosition < 9.9 && xTmpSideSpeed<0) {
        xPosition -= xTmpSideSpeed;
      } else if (xPosition > -9.9 && xTmpSpeed>0) {
        xPosition -= xTmpSpeed;
      } else if (xPosition > -9.9 && xTmpSideSpeed>0) {
        xPosition -= xTmpSideSpeed;
      }
      if (zPosition < 9.8 && zPosition > -9.8) {
        zPosition -= zTmpSpeed;
        zPosition -= zTmpSideSpeed;
      } else if (zPosition < 9.9 && zTmpSpeed<0) {
        zPosition -= zTmpSpeed;
      } else if (zPosition < 9.9 && zTmpSideSpeed<0) {
        zPosition -= zTmpSideSpeed;
      } else if (zPosition > -9.9 && zTmpSpeed>0) {
        zPosition -= zTmpSpeed;
      } else if (zPosition > -9.9 && zTmpSideSpeed>0) {
        zPosition -= zTmpSideSpeed;
      }
    }
    
    yaw += yawRate * elapsed;
    //Popravek yaw da je od 0 - 360
    if(yaw >= 360) {
      yaw -= 360;
    }
    if(yaw < 0) {
      yaw += 360;
    }
    pitch += pitchRate * elapsed;

  }
  lastTime = timeNow;
}

//
// Keyboard handling helper functions
//
// handleKeyDown    ... called on keyDown event
// handleKeyUp      ... called on keyUp event
//
function handleKeyDown(event) {
  // storing the pressed state for individual key
  //console.log(event.keyCode);
  currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
  // reseting the pressed state for individual key
  currentlyPressedKeys[event.keyCode] = false;
}

//
// handleKeys
//
// Called every time before redeawing the screen for keyboard
// input handling. Function continuisly updates helper variables.
//
function handleKeys() {
  
  //Look left/right
  if (currentlyPressedKeys[81]) {
    yawRate = 0.15;
  } else if (currentlyPressedKeys[69]) {
    yawRate = -0.15;
  } else {
    yawRate = 0;
  }
  
  //Shoot
  if (currentlyPressedKeys[32]) {
    if(!hasShot) {
      
      if(existsBullet == null) {
        existsBullet = new Bullet(xPosition,zPosition,yaw);
      }
      hasShot = true;
    }
  } else {
    hasShot = false;
  }
  
  //Side movement (A,D ali leva, desna puscia)
  if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {
    sideSpeed = -0.004;
  } else if (currentlyPressedKeys[39] || currentlyPressedKeys[68]) {
    sideSpeed = 0.004;
  } else {
    sideSpeed = 0;
  }

  if (currentlyPressedKeys[38] || currentlyPressedKeys[87]) {
    // Up cursor key or W
    speed = 0.004;
  } else if (currentlyPressedKeys[40] || currentlyPressedKeys[83]) {
    // Down cursor key
    speed = -0.004;
  } else {
    speed = 0;
  }
}
//HUD
function hud() {
  if (!gameOver) {
    ctx.font="30px Arial";
    ctx.fillStyle = "#ff0000";
    ctx.clearRect(0,0,1280,720);
    ctx.fillText("ENEMIES KILLED: "+enemiesKilled,30,50);
    
    //crosshair
    ctx.fillStyle = "#0070ff";  //prijetno moder
    //ctx.fillStyle = "#fff000"; //rumen
    ctx.beginPath();
    ctx.arc(640,349,2,0,2*Math.PI);
    ctx.lineWidth = 0;
    ctx.fill();
    ctx.fillRect(638,334,4,10);
    ctx.fillRect(638,354,4,10);
    ctx.fillRect(644,347,10,4);
    ctx.fillRect(626,347,10,4);
    
    //Hit indicator flash
    if(hitIndicatorAlpha > 0) {
      ctx.strokeStyle = "#0070ff";
      ctx.lineWidth = 4;
      ctx.globalAlpha = hitIndicatorAlpha;
      
      //top right
      ctx.beginPath();
      ctx.moveTo(645,343);
      ctx.lineTo(658,331);
      ctx.stroke();
      //top left
      ctx.beginPath();
      ctx.moveTo(635,343);
      ctx.lineTo(622,331);
      ctx.stroke();
      //bottom left
      ctx.beginPath();
      ctx.moveTo(635,354);
      ctx.lineTo(622,366);
      ctx.stroke();
      //bottom right
      ctx.beginPath();
      ctx.moveTo(645,354);
      ctx.lineTo(658,366);
      ctx.stroke();
      
      hitIndicatorAlpha -= 0.009;
      ctx.globalAlpha = 1.0;
    } else {
      hitIndicatorAlpha = 0;
    }
  }
}

//call this when game is over
function hudGameOver() {
  gameOver = true;
  ctx.clearRect(0,0,1280,720);
  ctx.font="130px Arial";
  ctx.fillStyle = "#ff7500";
  ctx.fillText("GAME OVER",220,300);
  ctx.font="30px Arial";
  ctx.fillStyle = "#ff0000";
  ctx.fillText("YOU KILLED: "+enemiesKilled+" ENEMIES",450,500);
  clearInterval(intervalID);
}


//
// start
//
// Called when the canvas is created to get the ball rolling.
// Figuratively, that is. There's nothing moving in this demo.
//
function start() {
  canvas = document.getElementById("glcanvas");
  //initiate HUD
  var tmp = document.getElementById("hud");
  ctx = tmp.getContext("2d");
  hud();
  
  gl = initGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working
  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
    gl.clearDepth(1.0);                                     // Clear everything
    gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
    gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.
    initShaders();
    
    //load models
    loadModels("data/models/toLoad.txt");
    
    // Next, load and set up the textures we'll be using.
    //initTextures();

    // Initialise world objects
    //loadWorld();

    // Bind keyboard handling functions to document handlers
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;

    // Set up to draw the scene periodically.
    intervalID = setInterval(function() {
      if (loadedModels==0 && loadedTextures==0) { // only draw scene and animate when textures are loaded.
        document.getElementById("loadingtext").textContent = "";
        requestAnimationFrame(animate);
        handleKeys();
        drawScene();
      }
    }, 15);
  }
}

//checks if the game is over
// further: check if one of the four robots is 0.7 near player on x or z axis
function gameOverCheck() {
  for(var i in arrayRobots) {
    if(arrayRobots[i] != null) {
      if(Math.abs(arrayRobots[i].xPosition-xPosition) < 0.2 && Math.abs(arrayRobots[i].zPosition-zPosition) < 0.2) {
        hudGameOver();
      }
    }
  }
}

//Bullet functions
function moveBullet(elapsed) {
  if(existsBullet != null) {
    if (existsBullet.lifeSpan <= 0) {
      existsBullet = null;
    } else {
      existsBullet.lifeSpan--;
      existsBullet.xPosition -= Math.sin(degToRad(existsBullet.yaw)) * existsBullet.speed * elapsed;
      existsBullet.zPosition -= Math.cos(degToRad(existsBullet.yaw)) * existsBullet.speed * elapsed;
      //console.log("Bullet x: "+existsBullet.xPosition+", z: "+existsBullet.zPosition);
    }
  }
}

//Robot functions
//creates new robos, alive ones are left to live another day :)
function repopulate() {
  if (arrayRobots[0] == null && robotRespawnTimer[0] == 0) {
    arrayRobots[0] = new Robot(10,10);
  } else if(robotRespawnTimer[0] > 0) {
    robotRespawnTimer[0]--;
  }
  if (arrayRobots[1] == null && robotRespawnTimer[1] == 0) {
    arrayRobots[1] = new Robot(10,-10);
  } else if(robotRespawnTimer[1] > 0) {
    robotRespawnTimer[1]--;
  }
  if (arrayRobots[2] == null && robotRespawnTimer[2] == 0) {
    arrayRobots[2] = new Robot(-10,-10);
  } else if(robotRespawnTimer[2] > 0) {
    robotRespawnTimer[2]--;
  }
  if (arrayRobots[3] == null && robotRespawnTimer[3] == 0) {
    arrayRobots[3] = new Robot(-10,10);
  } else if(robotRespawnTimer[3] > 0) {
    robotRespawnTimer[3]--;
  }
}

function moveRobots() {
  //console.clear();
  //console.log("MY X: "+xPosition+", MY Z: "+zPosition+", MY YAW: "+yaw);
  
  if(arrayRobots[0] != null) {
    if(arrayRobots[0].xPosition > xPosition) {
      arrayRobots[0].xPosition -= arrayRobots[0].speed;
    } else if(arrayRobots[0].xPosition < xPosition) {
      arrayRobots[0].xPosition += arrayRobots[0].speed;
    }
    //premik v smeri z
    if(arrayRobots[0].zPosition > zPosition) {
      arrayRobots[0].zPosition -= arrayRobots[0].speed;
    } else if(arrayRobots[0].zPosition < zPosition) {
      arrayRobots[0].zPosition += arrayRobots[0].speed;
    }
    //console.log("Yaw: "+arrayRobots[0].yaw);
    //console.log("xPosition0: "+arrayRobots[0].xPosition+", zPosition: "+arrayRobots[0].zPosition);
  }
  if(arrayRobots[1] != null) {
    if(arrayRobots[1].xPosition > xPosition) {
      arrayRobots[1].xPosition -= arrayRobots[1].speed;
    } else if(arrayRobots[1].xPosition < xPosition) {
      arrayRobots[1].xPosition += arrayRobots[1].speed;
    }
    //premik v smeri z
    if(arrayRobots[1].zPosition > zPosition) {
      arrayRobots[1].zPosition -= arrayRobots[1].speed;
    } else if(arrayRobots[1].zPosition < zPosition) {
      arrayRobots[1].zPosition += arrayRobots[1].speed;
    }
    //console.log("Yaw: "+arrayRobots[1].yaw);
    //console.log("xPosition1: "+arrayRobots[1].xPosition+", zPosition: "+arrayRobots[1].zPosition);
  }
  if(arrayRobots[2] != null) {
    if(arrayRobots[2].xPosition > xPosition) {
      arrayRobots[2].xPosition -= arrayRobots[2].speed;
    } else if(arrayRobots[2].xPosition < xPosition) {
      arrayRobots[2].xPosition += arrayRobots[2].speed;
    }
    //premik v smeri z
    if(arrayRobots[2].zPosition > zPosition) {
      arrayRobots[2].zPosition -= arrayRobots[2].speed;
    } else if(arrayRobots[2].zPosition < zPosition) {
      arrayRobots[2].zPosition += arrayRobots[2].speed;
    }
    //console.log("Yaw: "+arrayRobots[2].yaw);
    //console.log("xPosition2: "+arrayRobots[2].xPosition+", zPosition: "+arrayRobots[2].zPosition);
  }
  if(arrayRobots[3] != null) {
    if(arrayRobots[3].xPosition > xPosition) {
      arrayRobots[3].xPosition -= arrayRobots[3].speed;
    } else if(arrayRobots[3].xPosition < xPosition) {
      arrayRobots[3].xPosition += arrayRobots[3].speed;
    }
    //premik v smeri z
    if(arrayRobots[3].zPosition > zPosition) {
      arrayRobots[3].zPosition -= arrayRobots[3].speed;
    } else if(arrayRobots[3].zPosition < zPosition) {
      arrayRobots[3].zPosition += arrayRobots[3].speed;
    }
    //console.log("Yaw: "+arrayRobots[3].yaw);
    //console.log("xPosition3: "+arrayRobots[3].xPosition+", zPosition: "+arrayRobots[3].zPosition);
  }
}

function destroyRobot(numberOfRobotToDestroy) {
  enemiesKilled++;
  arrayRobots[numberOfRobotToDestroy] = null;
  robotRespawnTimer[numberOfRobotToDestroy] = respawnTime;
}

function radToDeg(rad) {
  return rad*180/Math.PI;
}

function recalculateYawRobots(i) {
  for(var i in arrayRobots) {
    if(arrayRobots[i] != null) {
      if(arrayRobots[i].xPosition > xPosition && arrayRobots[i].zPosition > zPosition) {
        //spodnji desni kvadrant
        arrayRobots[i].yaw = radToDeg(Math.atan(Math.abs(arrayRobots[i].xPosition - xPosition) / Math.abs(arrayRobots[i].zPosition - zPosition)));
      } else if(arrayRobots[i].xPosition > xPosition && arrayRobots[i].zPosition < zPosition) {
        //zgornji desni kvadrant
        arrayRobots[i].yaw = 180 - radToDeg(Math.atan(Math.abs(arrayRobots[i].xPosition - xPosition) / Math.abs(arrayRobots[i].zPosition - zPosition)));
      } else if(arrayRobots[i].xPosition < xPosition && arrayRobots[i].zPosition < zPosition) {
        //zgornji levi kvadrant
        arrayRobots[i].yaw = 180 + radToDeg(Math.atan(Math.abs(arrayRobots[i].xPosition - xPosition) / Math.abs(arrayRobots[i].zPosition - zPosition)));
      } else if(arrayRobots[i].xPosition < xPosition && arrayRobots[i].zPosition > zPosition) {
        //spodnji levi kvadrant
        arrayRobots[i].yaw = 360 - radToDeg(Math.atan(Math.abs(arrayRobots[i].xPosition - xPosition) / Math.abs(arrayRobots[i].zPosition - zPosition)));
      }
    }
  }
}

function checkIfShot() {
  var shotSensitivity = 0.5;
  if(existsBullet != null) {
    if(arrayRobots[0] != null) {
      if(Math.abs(arrayRobots[0].xPosition - existsBullet.xPosition) < shotSensitivity && Math.abs(arrayRobots[0].zPosition - existsBullet.zPosition) < shotSensitivity) {
        destroyRobot(0);
        hitIndicatorAlpha = 1.0;
        //console.log("Robot 0 Destroyed");
      }
    }
    if(arrayRobots[1] != null) {
      if(Math.abs(arrayRobots[1].xPosition - existsBullet.xPosition) < shotSensitivity && Math.abs(arrayRobots[1].zPosition - existsBullet.zPosition) < shotSensitivity) {
        destroyRobot(1);
        hitIndicatorAlpha = 1.0;
        //console.log("Robot 1 Destroyed");
      }
    }
    if(arrayRobots[2] != null) {
      if(Math.abs(arrayRobots[2].xPosition - existsBullet.xPosition) < shotSensitivity && Math.abs(arrayRobots[2].zPosition - existsBullet.zPosition) < shotSensitivity) {
        destroyRobot(2);
        hitIndicatorAlpha = 1.0;
        //console.log("Robot 2 Destroyed");
      }
    }
    if(arrayRobots[3] != null) {
      if(Math.abs(arrayRobots[3].xPosition - existsBullet.xPosition) < shotSensitivity && Math.abs(arrayRobots[3].zPosition - existsBullet.zPosition) < shotSensitivity) {
        destroyRobot(3);
        hitIndicatorAlpha = 1.0;
        //console.log("Robot 3 Destroyed");
      }
    }
  }
}