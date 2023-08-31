(function app() {  // Fetch the WebSocket URL from the server
  fetch("/config")
    .then((response) => response.json())
    .then((config) => {
      const wsUrl = config.wsUrl;
      let socket;
      const userCursors = new Map();
  
      function generateValidColor() {
        const bgL = 0.2126 * (244 / 255) ** 2.2 + 0.7152 * (244 / 255) ** 2.2 + 0.0722 * (244 / 255) ** 2.2;
        const c = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722','#795548','#9e9e9e','#607d8b','#ffffff'];
      
        for (let i = 0; i < 20; i++) {
          const r = Math.floor(Math.random() * 256), g = Math.floor(Math.random() * 256), b = Math.floor(Math.random() * 256);
          const l = 0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2;
          const v = (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05);
          if (v >= 3) return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
        }
        
        return c[Math.floor(Math.random() * 20)];
      }  
      
      // Set the default value of the color picker
      document.getElementById("cursorColor").value = generateValidColor();
      
      function createRoom(event) {
        event.preventDefault();

        const usernameInput = document.getElementById("username");
        const username = usernameInput.value.trim();

        if (!username) {
          usernameInput?.setCustomValidity("Username is required!");
          usernameInput.reportValidity();
          usernameInput.addEventListener('input', () => usernameInput?.setCustomValidity(""));
          return;
        }

        const cursorColorInput = document.getElementById("cursorColor");
        const cursorColor = cursorColorInput.value;

        if (!isValidContrast(cursorColor, '#f4f4f4')) {
          cursorColorInput.setCustomValidity('Please select a darker color.');
          cursorColorInput.reportValidity();
          return;
        }

        cursorColorInput.setCustomValidity('');

        fetch("/create_room", { method: "POST" })
          .then((response) => response.json())
          .then((data) => {
            const roomId = data.roomId;
            joinRoomById(roomId, username);
          });
      }
      
      function joinRoom(event) {
        event.preventDefault();
      
        const joinRoomIdInput = document.getElementById("joinRoomId");
        const cursorColorInput = document.getElementById("cursorColor");
        const username = document.getElementById("username").value;
        const roomId = joinRoomIdInput.value;
        const cursorColor = cursorColorInput.value;
      
        // Clear previous custom validity for both inputs
        joinRoomIdInput.setCustomValidity('');
        cursorColorInput.setCustomValidity('');
      
        // Validate color
        if (!isValidContrast(cursorColor, '#f4f4f4')) {
          cursorColorInput.setCustomValidity('Please select a darker color.');
          cursorColorInput.reportValidity();
          return;
        }
      
        // Validate the room ID
        validateRoomId(roomId)
          .then((isValid) => {
            if (!isValid) {
              joinRoomIdInput.setCustomValidity('This Room ID does not exist.');
              joinRoomIdInput.reportValidity();
              return;
            }
      
            // If all validations pass, join the room
            joinRoomById(roomId, username);
          })
          .catch(() => {
            joinRoomIdInput.setCustomValidity('Error validating room ID.');
            joinRoomIdInput.reportValidity();
          });
      }

      async function validateRoomId(roomId) {
        const response = await fetch('/validate_room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomId }),
        });
        const data = await response.json();
        return data.roomExists;
      }

      function joinRoomById(roomId, username) {
        const cursorColorInput = document.getElementById("cursorColor");
        const cursorColor = cursorColorInput.value;

        document.getElementById("connecting").classList.remove("hidden");
        document.getElementById("lobby").remove();

        socket = new WebSocket(`${wsUrl}/start_web_socket`);

        socket.onopen = () => {
          socket.send(JSON.stringify({ event: 'join-room', username, roomId, cursorColor }));
          document.getElementById("connecting").remove();
          document.querySelector('main').classList.add('connected');
          document.getElementById("chatroom").classList.remove('hidden');
          document.getElementById("announceButton").classList.remove("hidden");
          displayRoomId(roomId);
        };

        socket.onerror = () => {
          document.getElementById("connecting").innerHTML = "Error connecting to the server. Please try again.";
        };

        socket.onmessage = (m) => {
          const data = JSON.parse(m.data);

          switch (data.event) {
            case "joined-room": {
              socket.connectionKey = data.connectionKey; // <-- Add this line
              const chatHistory = data.chatHistory;
              for (const message of chatHistory) {
                  addMessage(message.username, message.message, message.cursorColor, message.isSystem);
              }
              break;
            }
            case "update-users":
              updateUsers(data.users);
              break;
            case "send-message": {
              if (data.message && data.message !== "" && data.message.length <= 560) addMessage(data.username, data.message, data.cursorColor, data.isSystem);
              break;
            }
            case "update-cursors":
              userCursors.clear();
              for (const { connectionKey, cursor, cursorColor, username } of data.cursors) {
                userCursors.set(connectionKey, { cursor, cursorColor, username });
              }
              updateCursors(userCursors);
              break;
          }
        };

        socket.onclose = function() {
          alert('Connection lost. Refreshing the page...');
          location.reload();
        };
      }

      function updateUsers(users) {
        const usersDiv = document.getElementById("users");
        usersDiv.innerHTML = "";
      
        for (const user of users) {
          const userDiv = document.createElement("div");
          userDiv.textContent = user.username;
          userDiv.style.color = user.cursorColor;
          usersDiv.appendChild(userDiv);
        }
      }  

      function displayRoomId(roomId) {
        const roomIdDisplay = document.getElementById('roomIdDisplay');
        roomIdDisplay.innerHTML = `Room ID: ${roomId} <button id="copyToClipboard" data-room-id="${roomId}">Copy to clipboard</button>`;
        
        const copyButton = document.getElementById('copyToClipboard');
        copyButton.addEventListener('click', (event) => {
          const roomId = event.target.getAttribute('data-room-id');
          copyToClipboard(roomId);
        });
      }

      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
          const copyButton = document.getElementById("copyToClipboard");
          copyButton.textContent = "Copied!";
          setTimeout(() => {
            copyButton.textContent = "Copy to clipboard";
          }, 2000);
        });
      }
      
      function addMessage(username, message, cursorColor, isSystem = false) {
        const conversationDiv = document.getElementById("conversation");
        const messageDiv = document.createElement("div");
      
        const messageSpan = document.createElement("span");
        messageSpan.textContent = message;
        messageSpan.style.color = cursorColor;
      
        if (isSystem) {
          messageSpan.style.fontStyle = "italic";
        } else {
          const usernameSpan = document.createElement("b");
          usernameSpan.textContent = username + ": ";
          usernameSpan.style.color = cursorColor;
          messageDiv.appendChild(usernameSpan);
        }
      
        messageDiv.appendChild(messageSpan);
        conversationDiv.appendChild(messageDiv);
      }  
      
      function updateCursors(userCursors) {
        const cursorDiv = document.getElementById("cursors");
      
        // Remove cursors that are not in the updated userCursors
        Array.from(cursorDiv.children).forEach(cursorElement => {
          const connectionKey = cursorElement.getAttribute('data-user');
          if (!userCursors.has(connectionKey)) {
            cursorDiv.removeChild(cursorElement);
          }
        });
      
        // Update or add new cursors
        for (const [connectionKey, { cursor: cursorPosition, cursorColor, username }] of userCursors.entries()) {
          // Skip the cursor if it belongs to the current user
          if (connectionKey === socket.connectionKey) continue;
      
          let cursorElement = document.querySelector(`.cursor-icon[data-user="${connectionKey}"]`);
      
          // If cursor element doesn't exist, create a new one
          if (!cursorElement) {
            cursorElement = document.createElement("div");
            cursorElement.className = "cursor-icon";
            cursorElement.setAttribute('data-user', connectionKey);
            cursorElement.style.userSelect = "none";
            cursorElement.style.pointerEvents = "none";
            cursorElement.style.color = cursorColor;
      
            const svgElement = createCursorSVG();
            cursorElement.appendChild(svgElement);
            cursorElement.appendChild(document.createTextNode(username));
            cursorDiv.appendChild(cursorElement);
          }
      
          cursorElement.style.position = "absolute";
          cursorElement.style.left = `${cursorPosition.x}px`;
          cursorElement.style.top = `${cursorPosition.y}px`;
        }
      }

      function createCursorSVG() {
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttributeNS(null, "viewBox", "8.2 4.9 11.6 18.2");
        svgElement.setAttributeNS(null, "fill", "currentColor");
        svgElement.setAttributeNS(null, "height", "18.2");
        svgElement.setAttributeNS(null, "width", "11.6");
    
        const polygon1 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon1.setAttributeNS(null, "points", "8.2,20.9 8.2,4.9 19.8,16.5 13,16.5 12.6,16.6");
        polygon1.setAttributeNS(null, "fill", "#000000");
        svgElement.appendChild(polygon1);
    
        const polygon2 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon2.setAttributeNS(null, "points", "17.3,21.6 13.7,23.1 9,12 12.7,10.5");
        polygon2.setAttributeNS(null, "fill", "#000000");
        svgElement.appendChild(polygon2);
    
        const rectangle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rectangle.setAttributeNS(null, "x", "12.5");
        rectangle.setAttributeNS(null, "y", "13.6");
        rectangle.setAttributeNS(null, "width", "2");
        rectangle.setAttributeNS(null, "height", "8");
        rectangle.setAttributeNS(null, "transform", "matrix(0.9221 -0.3871 0.3871 0.9221 -5.7605 6.5909)");
        svgElement.appendChild(rectangle);
    
        const polygon3 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon3.setAttributeNS(null, "points", "9.2,7.3 9.2,18.5 12.2,15.6 12.6,15.5 17.4,15.5");
        svgElement.appendChild(polygon3);
    
        return svgElement;
      }
    
      function isValidContrast(color1, color2) {
        return getContrastRatio(color1, color2) >= 3; // WCAG 2.1 Level AA for graphics
      }

      function getContrastRatio(color1, color2) {
        const luminance1 = getRelativeLuminance(getRGBComponents(color1));
        const luminance2 = getRelativeLuminance(getRGBComponents(color2));
        return (Math.max(luminance1, luminance2) + 0.05) / (Math.min(luminance1, luminance2) + 0.05);
      }

      function getRelativeLuminance(rgb) {
        const sRGB = rgb.map(component => component / 255);
        const linearRGB = sRGB.map(component => component <= 0.03928 ? component / 12.92 : Math.pow((component + 0.055) / 1.055, 2.4));
        const R = linearRGB[0] * 0.2126;
        const G = linearRGB[1] * 0.7152;
        const B = linearRGB[2] * 0.0722;
        return R + G + B;
      }

      function getRGBComponents(color) {
        const el = document.createElement('div');
        el.style.backgroundColor = color;
        document.body.appendChild(el);
        const computedStyle = window.getComputedStyle(el);
        const bgColor = computedStyle.backgroundColor;
        document.body.removeChild(el);
        const rgbMatch = bgColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
        return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
      }

      document.getElementById('createRoomButton').addEventListener('click', createRoom);
      document.getElementById('joinRoomForm').addEventListener('submit', joinRoom);
      document.getElementById('cursorColor').addEventListener('input', (event) => {
        event.target.setCustomValidity('');
      });
      
      document.getElementById('joinRoomId').addEventListener('input', (event) => {
        event.target.setCustomValidity('');
      });
      

      document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent the form from refreshing the page
        const inputElement = document.getElementById("data");
        const message = inputElement.value;
        inputElement.value = ""; // Clear the input field

        if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        socket.send(
          JSON.stringify({
            event: "send-message",
            message: message,
          })
        );
      });

      let lastCursorUpdate = 0;
      document.addEventListener("mousemove", (e) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        const now = Date.now();
        const updateFrequency = 16; // in milliseconds
        if (now - lastCursorUpdate > updateFrequency) {
          lastCursorUpdate = now;
          const cursorPosition = { x: e.clientX, y: e.clientY };
          if (socket) {
            socket.send(
              JSON.stringify({
                event: "send-cursor",
                cursor: cursorPosition,
              })
            );
          }
        }
      });

      document.getElementById('announceButton').addEventListener('click', () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        const buzzerMessage = {
          event: "buzzer-clicked",
        };
        socket.send(JSON.stringify(buzzerMessage));
        enableCooldown();
      });
      
      function enableCooldown() {
        const button = document.getElementById('announceButton');
        button.classList.add('button-cooldown');
        setTimeout(function() {
          button.classList.remove('button-cooldown');
        }, 4000); //
      }
  });
})();
