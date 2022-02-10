/* eslint-disable require-jsdoc */
'use strict';
const playerDivs = {};

// method to add presence updates to a list
function updatePresenceList(playerNickname, update, amIHost, totalPlayers) {
  const listItem = `<li class="list-group-item"> ${playerNickname} ${update}</li>`;
  if (amIHost) {
    const listEl = document.getElementById('host-players-list');
    listEl.innerHTML += listItem;
    listEl.scrollTop = listEl.scrollHeight;
    document.getElementById('player-count').innerHTML =
      totalPlayers + ' player(s) online including you';
  } else {
    const listEl = document.getElementById('not-host-players-list');
    listEl.innerHTML += listItem;
    listEl.scrollTop = listEl.scrollHeight;
  }
}

// method to add game updates to a list
function updateGameNewsList(playerNickname, update) {
  const listItem = `<li class="list-group-item"> ${playerNickname} ${update}</li>`;
  const listEl = document.getElementById('game-updates-list');
  listEl.innerHTML += listItem;
  listEl.scrollTop = listEl.scrollHeight;
}

function showGameArea(amIHost) {
  if (amIHost) {
    document.getElementById('host-waiting').style.display = 'none';
    document.getElementById('host-gameplay').style.display = 'block';
  } else {
    document.getElementById('not-host-waiting').style.display = 'none';
    document.getElementById('not-host-gameplay').style.display = 'block';
  }
}

function showEndGameAlert(amIHost) {
  amIHost === true
    ? (document.getElementById('alert-host').style.display = 'block')
    : (document.getElementById('alert-not-host').style.display = 'block');
}

function showRoomCodeToShare(roomCode) {
  const roomNotReadyDiv = document.getElementById('room-not-ready');
  roomNotReadyDiv.style.display = 'none';
  const roomReadyDiv = document.getElementById('room-ready');
  roomReadyDiv.style.display = 'block';
  document.getElementById('random-room-code').innerHTML = roomCode;
}

export {
  updatePresenceList,
  updateGameNewsList,
  showGameArea,
  showEndGameAlert,
  showRoomCodeToShare
};
