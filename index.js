const ws = (() => {
  const multiplayerServer = getQueryVariable('m');
  if (multiplayerServer) {
    const ws = new WebSocket(multiplayerServer + '?id=' + localPlayerId);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      console.log('websocket open');

      ws.send(JSON.stringify({type: 'playerEnter'}));
    };
    ws.onclose = err => {
      console.log('websocket close');
    };
    ws.onerror = err => {
      console.warn('websocket error', err);
    };
    ws.onmessage = m => {
      const {data} = m;
      if (typeof data === 'string') {
        const j = JSON.parse(data);
        const {type} = j;

        switch (type) {
          case 'playerEnter': {
            const {id} = j;

            const playerMesh = _makeRemotePlayerMesh(id);
            scene.add(playerMesh);
            playerMeshes.push(playerMesh);
            if (audioCtx) {
              _bindPlayerMeshAudio(playerMesh);
            }

            const skinImg = new Image();
            skinImg.crossOrigin = 'Anonymous';
            skinImg.src = 'img/skins/male.png';
            skinImg.onload = () => {
              playerMesh.setImage(skinImg);
            };
            skinImg.onerror = err => {
              console.warn('skin image error', err.stack);
            };

            console.log('player enter', id);
            break;
          }
          case 'playerLeave': {
            const {id} = j;

            const playerMeshIndex = playerMeshes.findIndex(playerMesh => playerMesh.playerId === id);
            const playerMesh = playerMeshes[playerMeshIndex];
            scene.remove(playerMesh);
            playerMeshes.splice(playerMeshIndex, 1);

            console.log('player leave', id);
            break;
          }
          case 'objectAdd': {
            const {id} = j;

            const objectMesh = _makeObjectMesh(id);
            scene.add(objectMesh);
            objectMeshes.push(objectMesh);
            break;
          }
          case 'objectRemove': {
            const {id, owner} = j;

            const objectMeshIndex = objectMeshes.findIndex(objectMesh => objectMesh.objectId === id);
            const objectMesh = objectMeshes[objectMeshIndex];
            scene.remove(objectMesh);
            objectMeshes.splice(objectMeshes, 1);
            break;
          }
          case 'sync': {
            const objectId = 1;
            const objectMesh = objectMeshes.find(objectMesh => objectMesh.objectId === objectId);
            if (!objectMesh) {
              _addObject(objectId);

              ws.send(JSON.stringify({type: 'objectAdd', id: objectId}));
              ws.send(JSON.stringify({type: 'objectSetUpdateExpression', id: objectId, expression: '[1,2,3]'}));
            }
            break;
          }
          default: {
            console.warn('got invalid json messasge type', type);
            break;
          }
        }
      } else {
        const type = new Uint32Array(data, 0, 1)[0];
        if (type === MESSAGE_TYPES.PLAYER_MATRIX) {
          const id = new Uint32Array(data, Uint32Array.BYTES_PER_ELEMENT, 1)[0];
          const playerMesh = playerMeshes.find(playerMesh => playerMesh.playerId === id);

          playerMatrix.setArrayBuffer(data);
          playerMesh.update(playerMatrix);
        } else if (type === MESSAGE_TYPES.AUDIO) {
          if (voicechatEnabled) {
            const id = new Uint32Array(data, Uint32Array.BYTES_PER_ELEMENT, 1)[0];
            const playerMesh = playerMeshes.find(playerMesh => playerMesh.playerId === id);

            const float32Array = new Float32Array(data, Uint32Array.BYTES_PER_ELEMENT*2, (data.byteLength - Uint32Array.BYTES_PER_ELEMENT*2) / Float32Array.BYTES_PER_ELEMENT);
            playerMesh.audioBuffers.push(float32Array);
          }
        } else if (type === MESSAGE_TYPES.OBJECT_MATRIX) {
          const id = new Uint32Array(data, Uint32Array.BYTES_PER_ELEMENT, 1)[0];
          const objectMesh = objectMeshes.find(objectMesh => objectMesh.objectId === id);

          objectMatrix.setArrayBuffer(data);
          objectMesh.update(objectMatrix);
        } else {
          console.warn('unknown binary message type', {type});
        }
      }
    };
    return ws;
  } else {
    return null;
  }
})();
