let http=require('http');
const WebSocketServer = require('ws').Server;
const express = require("express");
const app=express();
const port=++process.env.PORT || 5000;
const server=http.createServer(app);
server.listen(port);
let notReadyPlayers = [];
let sessionsMap = new Map();
const wsServer = new WebSocketServer({server:server});
let counter = 0;

wsServer.on('connection', ws => {
    console.log('connect');
    notReadyPlayers.push(ws);
    ws.on('message', message => {
        let data = JSON.parse(message.toString());
        if (data.type === 'search') {
            counter++;
            let client = notReadyPlayers.splice(notReadyPlayers.indexOf(ws), 1)[0];
            sessionsMap.set(client, {
                couple: null,
                disposition: data.disposition,
                end:false

            });
            ws.send('search');
            console.log(!!(counter % 2));
            ws.send(JSON.stringify({group: 'setTurn', turn: !!(counter % 2)}));
            const entries = [...sessionsMap.entries()];
            if (entries.find(element => element[1].couple === null && element[0] !== ws)) {
                const wsPair = entries.find(element => element[1].couple === null && element[0] !== ws)[0];
                sessionsMap.get(wsPair).couple = ws;
                sessionsMap.get(ws).couple = wsPair;
                ws.send('start');
                sessionsMap.get(ws).couple.send('start');
            }
        } else if (data.type === 'move') {
            const row = Math.floor(data.y / 50);
            const column = Math.floor(data.x / 50);
            let enemyDisposition = sessionsMap.get(sessionsMap.get(ws).couple).disposition;
            const cellValue = enemyDisposition[row][column];
            enemyDisposition[row][column] = null;
            if (!enemyDisposition.flat(1).filter(element => element).length) {
                sessionsMap.get(ws).end=true;
                sessionsMap.get(sessionsMap.get(ws).couple).end=true;
                ws.send(JSON.stringify({group: 'end', win: true}));
                sessionsMap.get(ws).couple.send(JSON.stringify({group: 'end', win: false}));
                ws.send('end');
                sessionsMap.get(ws).couple.send('end');
            }

            if (cellValue === null) {
                return
            }
            const type = cellValue ? 'cross' : 'circle';
            const x = data.x;
            const y = data.y;
            let basicData = {
                type,
                x,
                y
            }
            let senderData = {
                ...basicData,
                address: 'computer',
            };
            let getterData = {
                ...basicData,
                address: 'player'
            }
            if (!cellValue) {
                ws.send(JSON.stringify({group: 'setTurn', turn: false}));
                sessionsMap.get(ws).couple.send(JSON.stringify({group: 'setTurn', turn: true}));

            }
            senderData = JSON.stringify(senderData);
            getterData = JSON.stringify(getterData);
            ws.send(senderData);
            sessionsMap.get(ws).couple.send(getterData);


        }
    });

    ws.on('close', () => {
        if(sessionsMap.get(ws)?.couple){
            counter-=2;
        }

        if (notReadyPlayers.find(element => element === ws)) {
            notReadyPlayers.splice(notReadyPlayers.indexOf(ws), 1);
        } else {
            if (sessionsMap.get(ws)?.couple) {
                if(!sessionsMap.get(ws).end){
                    sessionsMap.get(ws).couple.send('break');
                }
                sessionsMap.delete(sessionsMap.get(ws).couple);
            }
            sessionsMap.delete(ws);
        }

    });
})