/* eslint-disable require-jsdoc */
'use strict';

// method to generate a random room Id
function getRandomRoomId() {
  return Math.random().toString(36).substr(2, 8);
}

/**
 * method to create or join a room on button click
 */
function createOrJoin(action) {
  localStorage.clear();
  let roomCode;
  const isHost = action === 'create';
  const nickname = document.getElementById(action + '-nickname').value;
  if (isHost) {
    roomCode = getRandomRoomId();
  } else {
    roomCode = document.getElementById('join-room-code').value;
  }
  localStorage.setItem('isHost', isHost);
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('roomCode', roomCode);
  window.location.replace('/game?roomCode=' + roomCode + '&isHost=' + isHost);
  return false;
}

document.getElementById('create-form').addEventListener("submit", function(e) {
  e.preventDefault();
  createOrJoin("create")
  return false;
});

document.getElementById('join-form').addEventListener("submit", function(e) {
  e.preventDefault();
  createOrJoin("join")
  return false;
});
