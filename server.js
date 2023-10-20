const express = require('express')
const cors = require('cors');
const { WebSocketServer } = require('ws')
const app = express()
const { createServer } = require('http')
const { generateRoomId, shuffle, returnToNormalTurn } = require('./utils.js')

app.use(express.json())
app.use(cors());

const server = createServer(app)

const port = 3030

const wss = new WebSocketServer({ server });

const rooms = {
    //room_name: {
    //    user_name_1: {
    //        'ws': WebSocket Connection,
    //        room: current_room_name
    //    },
    //}
}
const users = {
    //user_name: {
    //    'ws': WebSocket Connection,
    //    room: current_room_name
    //}
}
const cards_per_room = {
    //room_name: [card_array],
}

const turn_per_room = {
    //room_name: [players_name_array],
}

wss.on('connection', function connection(ws, req, clt) {
    ws.on('error', console.error);
    
    // Creating user
    const user = req.url.split('user=')[1]
    if(users[user]) {
        console.error('Usuário já existente')
        ws.close()
    } else {
        users[user] = {ws, room: null}
        console.log(`Usuário ${user} conectou!`)
    }

    ws.on('message', function message(data) {
        const message = JSON.parse(data)

        if(message["protocol"] === 'ENTER_ROOM') {
            const room = message["room"]

            if(rooms[room] == undefined) {// Se a sala não existe
                ws.send(JSON.stringify({protocol: 'ENTER_ROOM_FAILED', msg: 'Sala não existe'}))
            } else {
                rooms[room] = {...rooms[room], [`${user}`]: users[user]}
                users[user]['room'] = room
                console.log(`Usuário ${user} entrou com sucesso na sala ${room}`)
                room_broadcast(room, {protocol: 'USER_ENTERED', users: Object.keys(rooms[room]).map((user) => `${user}`)})
            }
        }

        if(message["protocol"] === 'NEXT_TURN'){
            const user_room = users[user].room;
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user) {
                // Always normalize the turn (can't have duplicates)
                turn_per_room[user_room] = returnToNormalTurn(turn_per_room[user_room])
                nextTurn(user_room)
            }
        }

        if(message["protocol"] === 'TAKE_CARD'){
            const user_room = users[user].room;
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user) {
                const card = cards_per_room[user_room].pop()
                ws.send(JSON.stringify({protocol: "YOU_TOOK_CARD", card}))
                
                if(isActionCard(card)){ // Se for carta de ação, apenas quem puxou sabe qual carta foi
                    ws.send(JSON.stringify({protocol: "PLAYER_TOOK_CARD", card, player: user}))
                    room_broadcast(user_room, {protocol: "PLAYER_TOOK_CARD", player: user, card: "ACTION_CARD"}, user)
                } else {
                    room_broadcast(user_room, {protocol: "PLAYER_TOOK_CARD", card, player: user})
                }
            }
        }

        if(message["protocol"] == 'TRANSFER_CARD'){
            const user_room = users[user].room;
            const target_user = message["target_user"]
            rooms[user_room][target_user]["ws"].send(JSON.stringify({protocol: "YOU_TOOK_CARD", card: message["card"]}))
        }

        if(message["protocol"] == 'GAMEOVER'){
            const user_room = users[user].room;
            const user_turn = turn_per_room[user_room].indexOf(user)
            turn_per_room[user_room].splice(user_turn,1)
            if(!user_turn) nextTurn(user_room)
        }

        if(message["protocol"] == 'ACTION_STACK_ADD'){
            const user_room = users[user].room;
            room_broadcast(user_room, {protocol: "ACTION_STACK_ADD", card_id: message["card_id"]})
        }

        if(message["protocol"] == 'ACTION_DONE'){
            const user_room = users[user].room;
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user) {
                if(message["executeActionsBefore"]){
                    room_broadcast(user_room, {protocol: "ACTION_STACK_REMOVE", executeActionsBefore: true})
                } else {
                    room_broadcast(user_room, {protocol: "ACTION_STACK_REMOVE", executeActionsBefore: false})
                }

                /** VERIFICAR QUAL CARTA FOI E REALIZAR A AÇÃO DEPENDENDO DA CARTA... TODO */
                if(message["card_id"] === 16 || message["card_id"] === 17) { // CARTA DE IMPEDIR DE USAR AÇÃO
                    room_broadcast(user_room, {protocol: "CARD_ACTION", action: "BLOCK_ACTIONS"})
                }

                if(message["card_id"] === 4 || message["card_id"] === 5) { // CARTA DE VER AS PRÓXIMAS 3 CARTAS DO BARALHO
                    const next_3_cards = cards_per_room[user_room].slice(cards_per_room[user_room].length-3,cards_per_room[user_room].length)
                    users[user]["ws"].send(JSON.stringify({protocol: "CARD_ACTION", action: "NEXT_3_CARDS", cards: next_3_cards}))
                }

                if(message["card_id"] === "PASS_OBSTACLE") { // CARTA DE VER AS PRÓXIMAS 3 CARTAS DO BARALHO
                    // Informar o target user para ele adicionar em myCurrentObstacle o novo obstáculo e setar o takenCard para o obstáculo
                    // Informar a todos da sala sobre o obstáculo ser do target user, e delegar o turno para ele
                    // Quando o target user terminar seu turno, os turnos normais devem seguir a ordem
                    nextTurn(user_room, message["target_user"])
                    users[message["target_user"]]["ws"].send(JSON.stringify({protocol: 'YOU_TOOK_CARD', card: message["obstacle"]}))
                    room_broadcast(user_room, {protocol: "PLAYER_TOOK_CARD", card: message["obstacle"], player: message["target_user"]})
                }
                // CARTA "Tô fora"
                if(message["card_id"] === 20 || message["card_id"] === 21) {
                    users[user]["ws"].send(JSON.stringify({protocol: "CARD_ACTION", action: "NO_NEED_TO_DRAW_CARD"}))
                }
                // CARTA DE PULAR O TURNO E O PRÓXIMO TER DOIS TURNOS
                if(message["card_id"] === 22) {
                    nextTurn(user_room, turn_per_room[user_room][1])
                }

            }
        }
    });

    ws.on('close', () => {
        const userRoom = users[user]['room']
        if(userRoom) { // Se usuário está em uma sala
            delete rooms[userRoom][user]

            // Delete the user that got out from the turn
            const index_user_in_turn = turn_per_room[userRoom].indexOf(user)
            turn_per_room[userRoom].splice(index_user_in_turn, 1)

            console.log(`Usuário ${user} foi removido da sala ${userRoom}`)
            room_broadcast(userRoom, {protocol: 'USER_LEFT', users: Object.keys(rooms[userRoom]).map((user) => `${user} está na sala!`)})
            setTimeout(() => {
                if(rooms[userRoom] && Object.keys(rooms[userRoom]).length === 0) {
                    delete rooms[userRoom]
                    delete cards_per_room[userRoom]
                    delete turn_per_room[userRoom]
                    console.log(`Sala ${userRoom} foi excluída por estar vazia`)
                }
            }, 5000)
        }
        delete users[user]
        console.log(`Usuário ${user} desconectou!`)
    });
    // ws.send(JSON.stringify({ message: 'something' }));
});

app.post('/criarSala', (req, res) => {
    const id = generateRoomId()
    const {user} = req.body

    if(!rooms[id]) {
        // Room contain room id and a dictionary, which contains the user name and their object
        rooms[id] = {[`${user}`]: users[user]}
        users[user]['room'] = id
        users[user]['ws'].send(JSON.stringify({protocol: "DELEGATE_START"}))
    } else {
        res.send({msg: 'Sala já existe'})
    }
    res.send({id})
})

app.get('/turno/:room', (req, res) => {
    const {room} = req.params
    
    let action_cards = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    let obstacles = [24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,
    77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94]
    action_cards = shuffle(action_cards)

    // Distributing initial cards
    Object.keys(rooms[room]).forEach(player => {
        const initial_cards = [18,20,22]//DEBUG
        // for(let i=0; i<3;i++) {
        //     initial_cards.push(action_cards.pop())
        // }
        rooms[room][player]['ws'].send(JSON.stringify({protocol: "INITIAL_CARDS", cards: initial_cards}))
    });

    let cards = [...obstacles, ...action_cards]
    cards = shuffle(cards)
    cards.push(84) //DEBUG
    cards_per_room[room] = cards

    turn_per_room[room] = shuffle(Object.keys(rooms[room]))
    nextTurn(room)
});

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

function room_broadcast(room, json_msg, not_to_player=null) {
    for (const user in rooms[room]) {
        if(!not_to_player || not_to_player !== user) {
            users[user].ws.send(JSON.stringify(json_msg))
        }
    }
}

function warnPlayersAboutTurn(room, currentPlayer) {
    // Avisa a todos de quem é o turno (incluindo o atual jogador)
    turn_per_room[room].forEach((player) => {
        if(currentPlayer === player) {
            rooms[room][player]['ws'].send(JSON.stringify({protocol: "YOUR_TURN"}))
        } else {
            rooms[room][player]['ws'].send(JSON.stringify({protocol: "THEIR_TURN", current_player: currentPlayer}))
        }
    })
}

function nextTurn(room, userPlayingNext=null) {
    if(!userPlayingNext){
        const next_player = turn_per_room[room].pop()
        turn_per_room[room].unshift(next_player)
    } else { // Caso o turno seja delegado por um obstáculo, coloca o novo jogador no inicio do turno para indicar que o turno é dele (qnd ele passar o turno, remover)
        turn_per_room[room].unshift(userPlayingNext)
    }

    // Os que estão na sala, mas já morreram/estão presos
    let locked_or_deads = Object.keys(rooms[room]).filter(x => !turn_per_room[room].includes(x));

    if(userPlayingNext) {
        warnPlayersAboutTurn(room, userPlayingNext)
    } else {
        warnPlayersAboutTurn(room, turn_per_room[room][0])
    }

    // Avisa a todos os mortos e presos de quem é o turno
    locked_or_deads.forEach((player)=>{
        rooms[room][player]['ws'].send(JSON.stringify({protocol: "THEIR_TURN", current_player: userPlayingNext ? userPlayingNext : turn_per_room[room][0]}))
    })
}

function isActionCard(card_id) {
    if(card_id <= 23) return true
    else return false
}

function isBadObstacleCard(card_id) {
    if(card_id >= 24 && card_id <= 63) return true
    else return false
}

function isBonusObstacleCard(card_id) {
    if(card_id >= 64 && card_id <= 84) return true
    else return false
}

function isJobCard(card_id) {
    if(card_id >= 85 && card_id <= 94) return true
    else return false
}