const express = require('express')
const cors = require('cors');
const { WebSocketServer } = require('ws')
const app = express()
const { createServer } = require('http')
const { generateRoomId, shuffle, returnToNormalTurn, isActionCard } = require('./src/utils.js')
const { config } = require('dotenv')
const {MongoDBConnection} = require('./src/database/mongodb.js')
const {MongoUserController} = require('./src/controllers/MongoDB/MongoUserController.js');
const { MemoryUserController } = require('./src/controllers/Memory/MemoryUserController.js');
const { MemoryRoomController } = require('./src/controllers/Memory/MemoryRoomController.js');
const {UserActions} = require('./src/UserActions.js');
const { RoomActions } = require('./src/RoomActions.js');


config();
app.use(express.json())
app.use(cors());

const server = createServer(app)
const port = 3030
const wss = new WebSocketServer({ server });

const cards_per_room = {
    //room_name: [card_array],
}

const turn_per_room = {
    //room_name: [players_name_array],
}

// const DatabaseConnection = new MongoDBConnection()
let userController = new MemoryUserController();
let roomController = new MemoryRoomController(userController);
const userActions = new UserActions(userController, roomController)
const roomActions = new RoomActions(userController, roomController, turn_per_room, cards_per_room)
// DatabaseConnection.connectToCluster(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER_NAME}.wbtnp9r.mongodb.net/?retryWrites=true&w=majority`)
// .then(() => {
//     userController = new MongoUserController(DatabaseConnection.getConnection());
// })


wss.on('connection', function connection(ws, req, clt) {
    ws.on('error', console.error);
    
    // Creating user
    const queries = req.url.split('?')[1].split('&')
    const user_name = queries[0].split('user=')[1]
    let user_token = queries[1].split('user_token=')[1]

    if(userController.checkUserAlreadyExists({user_token}) && userController.getUserRoom({user_token}) && !userController.isConnected({user_token})) {
        // O usuário reconectou e já está em uma sala. Se ele estiver apenas acessando a página inicial (sem numero de sala no link), redirecionar ele para a sua sala
    } else if(userController.checkUserAlreadyExists({user_token}) && !userController.isConnected({user_token})) {
        // Se o usuário nao estiver em nenhuma sala, mas já existir (está reconectando tambem)
        if(user_name !== userController.getUser({user_token}).name) userController.setUserName({user_token, user_name})
        userController.connectUser({user_token, ws})
    } else {
        // Se não existir, criar um novo usuário
        user_token = userController.createUser({name: user_name, ws})
        ws.send(JSON.stringify({protocol: 'CREATING_USER', token: user_token}))
        console.log(`Usuário ${user_name} foi criado e conectou!`)
    }

    ws.on('message', function message(data) {
        const message = JSON.parse(data)

        if(message["protocol"] === 'ENTER_ROOM') {
            const newRoom = message["room"]
            console.log(`${user_name} mandou o enter room`)
            roomActions.userEnterRoom({room_id: newRoom, user_token, user_name, ws})
        }

        if(message["protocol"] === 'NEXT_TURN'){
            const user_room = userController.getUserRoom({user_token});
            userController.setMyCurrentObstacle({user_token, myCurrentObstacle: null})
            userController.setNoNeedToDrawCard({user_token, noNeedToDrawCard: false})
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user_name) {
                nextTurn(user_room)
            }
        }

        if(message["protocol"] === 'TAKE_CARD'){
            const user_room = userController.getUserRoom({user_token});
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user_name) {
                const card = cards_per_room[user_room].pop()

                userController.setMysteriousPresent({user_token, mysteriousPresent: null})

                userActions.drawCard({user_token, room_id: user_room, card, user_name})
                
                roomController.setWhoTookCard({room_id: user_room, whoTookCard: user_name})
                if(isActionCard(card)){ // Se for carta de ação, apenas quem puxou sabe qual carta foi
                    userController.setTakenCard({user_token, takenCard: card})

                    roomController.getArrUsersTokensInRoom({room_id: user_room}).forEach(token => {
                        if(token !== user_token) {
                            userController.setTakenCard({user_token: token, takenCard: "ACTION_CARD"})
                        }
                    })
                } else {
                    roomController.getArrUsersTokensInRoom({room_id: user_room}).forEach(token => {
                        userController.setTakenCard({user_token: token, takenCard: card})
                    })
                }

                if(cards_per_room[user_room].length === 0) {
                    roomController.room_broadcast(user_room, {protocol: "CARDS_OVER"})
                }
            }
        }

        if(message['protocol' == 'DISCARD_CARD']){
            const myHand = [...userController.getMyHand({user_token})]
            const indexOfCard = myHand.indexOf(message['card'])
            if(indexOfCard !== -1){
                myHand.splice(indexOfCard, 1)
                userController.setMyHand({user_token, myHand})
            }
        }

        if(message["protocol"] == 'TRANSFER_CARD'){
            const user_room = userController.getUserRoom({user_token});

            // Removing from source
            const myHand = [...userController.getMyHand({user_token})]
            const indexOfCard = myHand.indexOf(message['card'])
            if(indexOfCard !== -1){
                myHand.splice(indexOfCard, 1)
                userController.setMyHand({user_token, myHand})
            }

            // Sending to destination
            const target_user = message["target_user"]
            const target_user_token = roomController.getUserTokenByName({user_name: target_user, room_id: user_room})
            if(target_user_token) {
                userActions.drawCard({user_token: target_user_token, room_id: user_room, card: message["card"], user_name: target_user})
            } else {
                console.log(`Erro ao conseguir o token do usuário ${target_user} na transferência de carta`)
            }
        }

        if(message["protocol"] == 'GAMEOVER'){
            const user_room = userController.getUserRoom({user_token});

            // Removing from alivePlayers
            const alivePlayers = [...roomController.getAlivePlayers({room_id: user_room})]
            const indexOfDeadPlayer = alivePlayers.indexOf(user_name)
            alivePlayers.splice(indexOfDeadPlayer, 1)
            roomController.setAlivePlayers({room_id: user_room, alivePlayers})

            // Removing from pyramid
            const pyramidPlayers = [...roomController.getPyramidPlayers({room_id: user_room})]
            const deadInPyramid = pyramidPlayers.indexOf(user_name)
            if(deadInPyramid !== -1) {
                pyramidPlayers.splice(deadInPyramid, 1)
                roomController.setPyramidPlayers({room_id: user_room, pyramidPlayers})
            }

            // Removing mysterious present
            userController.setMysteriousPresent({user_token, mysteriousPresent: false})

            const user_turn = turn_per_room[user_room].indexOf(user_name)

            if(user_turn !== -1) {
                turn_per_room[user_room].splice(user_turn,1)
            } 

            if(user_turn === 0) { //Se o usuário que perdeu era o que estava jogando, passar o turno
                userController.setMyTurn({user_token, myTurn: false})
                nextTurn(user_room)
            }

            if(turn_per_room[user_room].length === 1) {
                const winner = turn_per_room[user_room][0]
                roomController.room_broadcast(user_room, {protocol: 'WINNER', winner})
            }
        }

        if(message["protocol"] == 'ACTION_STACK_ADD'){
            const user_room = userController.getUserRoom({user_token});

            // SE FOR A CARTA DE TÔ FORA (Basta ela estar na pilha de cartas de ações para impedir o jogador de puxar carta)
            if(message["card_id"] === 20 || message["card_id"] === 21) {
                roomController.getArrUsersTokensInRoom({room_id: user_room}).forEach((token) => {
                    if(userController.getMyTurn({user_token: token})) {
                        userController.setNoNeedToDrawCard({user_token: token, noNeedToDrawCard: true})
                    }
                })
            }

            roomController.setActionsStack({room_id: user_room, actionsStack: [...roomController.getActionsStack({room_id: user_room}), message["card_id"]]})
        }

        if(message["protocol"] == 'ACTION_DONE'){
            const user_room = userController.getUserRoom({user_token});
            // Checar se foi do usuário do turno atual mesmo
            if(turn_per_room[user_room][0] === user_name) {
                if(message["executeActionsBefore"]){
                    // Changing the state in the back-end
                    const previousActionsStack = [...roomController.getActionsStack({room_id: user_room})]
                    previousActionsStack.splice(previousActionsStack.length-2, 1)
                    roomController.setActionsStack({room_id: user_room, actionsStack: previousActionsStack})

                    // SE A CARTA "TÔ FORA ESTIVER PRESENTE NA PILHA, IMPEDIR DE PUXAR CARTA DO BOLO, SE NÃO, PODE PUXAR"
                    if(roomController.getActionsStack({room_id: user_room}).includes(20) || roomController.getActionsStack({room_id: user_room}).includes(21)) {
                        userController.setNoNeedToDrawCard({user_token, noNeedToDrawCard: true})
                    }
                } else {
                    // Changing the state in the back-end
                    const previousActionsStack = [...roomController.getActionsStack({room_id: user_room})]
                    previousActionsStack.pop()
                    roomController.setActionsStack({room_id: user_room, actionsStack: previousActionsStack})

                    // SE A CARTA "TÔ FORA ESTIVER PRESENTE NA PILHA, IMPEDIR DE PUXAR CARTA DO BOLO, SE NÃO, PODE PUXAR"
                    if(roomController.getActionsStack({room_id: user_room}).includes(20) || roomController.getActionsStack({room_id: user_room}).includes(21)) {
                        userController.setNoNeedToDrawCard({user_token, noNeedToDrawCard: true})
                    }
                }

                /** VERIFICAR QUAL CARTA FOI E REALIZAR A AÇÃO DEPENDENDO DA CARTA */
                if(message["card_id"] === 16 || message["card_id"] === 17) { // CARTA DE IMPEDIR DE USAR AÇÃO
                    const actionsStack = roomController.getActionsStack({room_id: user_room})
                    const blocked_card = actionsStack[actionsStack.length-1]

                    actionsStack.pop()
                    roomController.setActionsStack({room_id: user_room, actionsStack})

                    // SE A CARTA BLOQUEADA FOI A DE "TÔ FORA"
                    if(blocked_card === 20 || blocked_card === 21){
                        userController.setNoNeedToDrawCard({user_token, noNeedToDrawCard: false})
                    }
                }

                if(message["card_id"] === 4 || message["card_id"] === 5) { // CARTA DE VER AS PRÓXIMAS 3 CARTAS DO BARALHO
                    const next_3_cards = cards_per_room[user_room].slice(cards_per_room[user_room].length-3,cards_per_room[user_room].length)
                    userController.getUserConnection({user_token}).send(JSON.stringify({protocol: "CARD_ACTION", action: "NEXT_3_CARDS", cards: next_3_cards}))
                }

                if(message["card_id"] === "PASS_OBSTACLE") { // CARTA DE PASSAR O OBSTÁCULO
                    // Informar o target user para ele adicionar em myCurrentObstacle o novo obstáculo e setar o takenCard para o obstáculo
                    // Informar a todos da sala sobre o obstáculo ser do target user, e delegar o turno para ele
                    // Quando o target user terminar seu turno, os turnos normais devem seguir a ordem
                    userController.setMyCurrentObstacle({user_token, myCurrentObstacle: null})
                    userController.setTransferPyramidVisible({user_token, transferPyramidVisible: false})
                    nextTurn(user_room, message["target_user"])
                    const target_user_token = roomController.getUserTokenByName({room_id: user_room, user_name: message["target_user"]})
                    if(target_user_token){
                        userActions.drawCard({user_token: target_user_token, room_id: user_room, card: message["obstacle"], user_name: message["target_user"]})
                    } else {
                        console.log(`Erro ao conseguir o token do usuário ${message["target_user"]} na transferência de obstáculo`)
                    }
                    roomController.setWhoTookCard({room_id: user_room, whoTookCard: message["target_user"]})
                    roomController.getArrUsersTokensInRoom({room_id: user_room}).forEach(token => {
                        userController.setTakenCard({user_token: token, takenCard: message["obstacle"]})
                    })
                }
                // CARTA "Tô fora"
                if(message["card_id"] === 20 || message["card_id"] === 21) {
                    userController.setNoNeedToDrawCard({user_token, noNeedToDrawCard: true})
                }
                // CARTA DE PULAR O TURNO E O PRÓXIMO TER DOIS TURNOS
                if(message["card_id"] === 22) {
                    const turn = turn_per_room[user_room]
                    nextTurn(user_room, null, true)
                }

            }
        }

        if(message["protocol"] == 'OBSTACLE_ACTION'){
            const user_room = userController.getUserRoom({user_token});
            // Se for a carta de esquema de pirâmide
            if(message["card_id"] >= 26 && message["card_id"] <= 30 ){
                const newPyramid = [...roomController.getPyramidPlayers({room_id: user_room}), user_name]
                
                if(newPyramid.length === roomController.getAlivePlayers({room_id: user_room}).length){
                    console.log(`A pirâmide na sala ${user_room} chegou no máximo de jogadores, portanto será dissolvida!`)
                    // pyramidPlayersRef.current = []
                    roomController.setPyramidPlayers({room_id: user_room, pyramidPlayers: []})
                    roomController.room_broadcast(user_room, {protocol: "OBSTACLE_ACTION", action: "DISSOLVE_PYRAMID"})
                } else {
                    roomController.setPyramidPlayers({room_id: user_room, pyramidPlayers: newPyramid})
                }

            }
        }

        if(message["protocol"] == 'PYRAMID_DISSOLVE'){
            const user_room = userController.getUserRoom({user_token});
            roomController.setPyramidPlayers({room_id: user_room, pyramidPlayers: []})
        }

    });

    ws.on('close', async () => {
        const userRoom = userController.getUserRoom({user_token})

        if(userRoom) { // Se usuário está em uma sala
            userController.disconnectUser({user_token})
            console.log(`Usuário ${user_name} desconectou!`)

            let waitForUserReconnection = setTimeout(() => {
                // Se o estado do usuário for connected: false por mais de 30 segundos, ele remove da sala atual e remove o usuário
                roomActions.userLeftRoom({user_token, room_id: userRoom})
                console.log(`Usuário ${user_name} foi removido de sua sala por não reconectar!`)
            }, 30000)
            
            let checkUserReconnection = setInterval(() => {
                const userReconnecting = userController.getUser({user_token})
                if(!userReconnecting){
                    console.log(`Usuário ${user_name} foi já removido, portanto, limpando a checagem de reconexão!`)
                    clearInterval(checkUserReconnection)
                } else {
                    if(userController.isConnected({user_token})){
                        console.log(`Usuário ${user_name} reconectou!`)
                        clearInterval(checkUserReconnection)
                        clearTimeout(waitForUserReconnection)
                    }
                }
            }, 1000)

            console.log(`Usuários presentes na sala ${userRoom}:`)
            console.log(...roomController.getArrUsersNamesInRoom({room_id: userRoom}))
        } else {
            userController.disconnectUser({user_token})
            console.log(`Usuário ${user_name} foi desconectado. Não foi removido de nenhum sala, pois não está em nenhuma!`)
        }
    });
    // ws.send(JSON.stringify({ message: 'something' }));
});

app.post('/criarSala', (req, res) => {
    const id = generateRoomId()
    const {user} = req.body
    if(!roomController.checkRoomAlreadyExists({room_id: id}) && userController.checkUserAlreadyExists({user_token: user})) {
        // Room contain room id and a dictionary, which contains the user name and their object
        roomController.createRoom({room_id: id})
        roomController.setRoomAdminToken({roomAdminToken: user, room_id: id})
        res.send({id})
    } else if(userController.checkUserAlreadyExists({user_token: user})) {
        console.log('Não foi possível criar sala, ela ja existe')
        res.send({msg: 'Não foi possível criar sala, ela ja existe'})
    } else {
        console.log('Crie o usuario antes de criar uma sala')
        res.send({msg: 'Crie o usuario antes de criar uma sala'})
    }
})

app.get('/turno/:room', (req, res) => {
    const {room} = req.params
    
    let action_cards = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    let obstacles = [24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,
    77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94]
    action_cards = shuffle(action_cards)

    // Distributing initial cards
    roomController.getArrUsersNamesInRoom({room_id: room}).forEach(player => {
        const initial_cards = []//DEBUG
        for(let i=0; i<3;i++) {
            initial_cards.push(action_cards.pop())
        }
        const user_token = roomController.getUserTokenByName({user_name: player, room_id: room})
        userController.setMyHand({user_token, myHand: initial_cards})
    });
    roomController.setGameBegun({room_id: room, gameBegun: true})
    
    let cards = [...obstacles, ...action_cards]
    cards = shuffle(cards)
    // cards.push(27) //DEBUG
    // cards.push(28) //DEBUG
    cards_per_room[room] = cards

    turn_per_room[room] = shuffle(roomController.getArrUsersNamesInRoom({room_id: room}))
    nextTurn(room)

    res.send('Turn started')
});

app.get('/variables/:user_token', (req, res) => {
    const {user_token} = req.params
    if(userController.getUser({user_token})){
        const room_id = userController.getUserRoom({user_token})
        res.json({
            'room_state': roomController.getRoomState({room_id}),
            'user_state': userController.getUserState({user_token}),
            'cards_remaining': cards_per_room[room_id],
            'turns': turn_per_room[room_id]
        })
    } else {
        res.json({msg: 'User does not exist!'})
    }
})

app.get('/', (req, res) => {
    res.send('App up and running!')
});

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

function warnPlayersAboutTurn(room, currentPlayer) {
    // Avisa a todos de quem é o turno (incluindo o atual jogador)
    turn_per_room[room].forEach((player) => {
        if(currentPlayer === player) {
            const user_token = roomController.getUserTokenByName({user_name: player, room_id: room})
            if(user_token){
                roomController.setWhoTookCard({room_id: room, whoTookCard: ''})
                userController.setMyTurn({user_token, myTurn: true})
                userController.setTakenCard({user_token, takenCard: null})
                userController.setTheirTurn({user_token, theirTurn: ''})
            } else {
                console.log(`Erro ao conseguir o token do usuário ${player} ao dizer que o turno é dele`)
            }
        } else {
            const user_token = roomController.getUserTokenByName({user_name: player, room_id: room})
            if(user_token){
                roomController.setWhoTookCard({room_id: room, whoTookCard: ''})
                userController.setMyTurn({user_token, myTurn: false})
                userController.setTakenCard({user_token, takenCard: null})
                userController.setTheirTurn({user_token, theirTurn: currentPlayer})
            } else {
                console.log(`Erro ao conseguir o token do usuário ${player} ao dizer que o turno é de outra pessoa`)
            }
        }
    })
}

function nextTurn(room, userPlayingNext=null, doNextPlayerHaveTwoTurns=false) {
    /** userPlayingNext e doNextPlayerHaveTwoTurns não devem ser usados ao mesmo tempo. Um é usado para ceder o turno para alguém (cartas de obstáculos)
     * o outro é usado para o próximo jogador ter dois turnos e pular o turno do atual (dobro a passo pro próximo)
     */
    const turn = turn_per_room[room];
    let pass_and_double_next = false
    if(!userPlayingNext && !doNextPlayerHaveTwoTurns){
        const next_player = turn.pop()
        turn.unshift(next_player)
    } else { // Caso o turno seja cedido para alguém, coloca o novo jogador no inicio do turno para indicar que o turno é dele (qnd ele passar o turno, remover)
        // Se a carta de dobrar e passar pro próximo foi usada somente uma vez, adicionar o próximo jogador (o último da fila) no início da fila, 
        // pra indicar que o turno agora é dele e ele terá dois turnos. Caso ela tenha sido usada duas vezes seguidas, quem usou vai pular um turno
        // e o próximo terá dois (portanto, basta apenas mudar o último da fila pra ser igual ao penúltimo).
        if(doNextPlayerHaveTwoTurns && !userPlayingNext){
            if(turn[turn.length-1] === turn[0]) {
                userPlayingNext = turn[turn.length - 2]
                turn[turn.length-1] = userPlayingNext
                pass_and_double_next = true
                userPlayingNext = turn[0]
            } else {
                userPlayingNext = turn[turn.length-1]
                turn.unshift(userPlayingNext)
            }
        } else {
            turn.unshift(userPlayingNext)
        }
    }

    // When the turn passes, see if the last player is in the queue, and remove it (can't have duplicates)
    if(!pass_and_double_next){// To solve some edge cases
        returnToNormalTurn(turn)
    }

    // Os que estão na sala, mas já morreram/estão presos
    let locked_or_deads = roomController.getArrUsersNamesInRoom({room_id: room}).filter(x => !turn.includes(x));

    if(userPlayingNext) {
        warnPlayersAboutTurn(room, userPlayingNext)
    } else {
        warnPlayersAboutTurn(room, turn[0])
    }

    // Avisa a todos os mortos e presos de quem é o turno
    locked_or_deads.forEach((player)=>{
        const user_token = roomController.getUserTokenByName({user_name: player, room_id: room})
        userController.setTheirTurn({user_token, theirTurn: turn[0]})
    })
}