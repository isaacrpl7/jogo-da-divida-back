class MemoryRoomController {
    constructor(userController) {
        this.userController = userController
        this.rooms = {
            //room_id: {
            //    user_token: {
            //        'ws': WebSocket Connection,
            //        connected:
            //        name:
            //        room: current_room_name
            //    },
            //}
        }
        this.rooms_state = {
            //room_id: {
                // gameBegun
                // alivePlayers
                // whoTookCard
                // pyramidPlayers
                // actionsStack
            //}
        }
    }

    checkRoomAlreadyExists({ room_id }){
        if(this.rooms[room_id] === undefined) {
            return false
        }
        return true
    }
    
    createRoom({ room_id }){
        this.rooms = {
            ...this.rooms,
            [`${room_id}`]: {}
        }
        this.rooms_state = {
            ...this.rooms_state,
            [`${room_id}`]: {
                gameBegun: false,
                alivePlayers: [],
                whoTookCard: '',
                pyramidPlayers: [],
                actionsStack: []
            }
        }
    }

    getRoomState({room_id}) {
        return this.rooms_state[room_id]
    }

    room_broadcast(room, json_msg, not_to_player=null) {
        this.getArrUsersNamesInRoom({room_id: room}).forEach((user) => {
            if(!not_to_player || not_to_player !== user) {
                const user_token = this.getUserTokenByName({room_id:room, user_name: user})
                if(user_token) {
                    this.userController.getUserConnection({user_token}).send(JSON.stringify(json_msg))
                } else {
                    console.log(`Erro ao conseguir o token do usuário ${user} no broadcast`)
                }
            }
        })
    }

    addUserToRoom({room_id, user_token}){
        if(this.checkRoomAlreadyExists({room_id})){
            this.rooms[room_id][user_token] = this.userController.getUser({user_token})
            this.userController.setUserRoom({user_token, room_id})
        }
    }

    removeUserFromRoom({room_id, user_token}) {
        if(this.checkRoomAlreadyExists({room_id})){
            delete this.rooms[room_id][user_token]
            this.userController.setUserRoom({user_token,room_id:null})
        }
    }

    getArrUsersTokensInRoom({ room_id }) {
        if(this.checkRoomAlreadyExists({room_id})) {
            return Object.keys(this.rooms[room_id])
        }
        return []
    }

    getArrUsersNamesInRoom({ room_id }) {
        if(this.checkRoomAlreadyExists({room_id})) {
            const users_tokens = Object.keys(this.rooms[room_id])
            const users_name = users_tokens.map((user_token) => {
                return this.rooms[room_id][user_token].name
            })
            return users_name
        }
        return []
    }

    getUserTokenByName({room_id, user_name}){
        const user_tokens = this.getArrUsersTokensInRoom({room_id})
        let user_token = null;
        user_tokens.forEach((token) => {
            if(this.rooms[room_id][token].name === user_name) {
                user_token = token;
            }
        })
        return user_token
    }

    removeRoom({ room_id }) {
        delete this.rooms[room_id]
        delete this.rooms_state[room_id]
    }

    sendRoomStateToUser({room_id, user_token}) {
        this.userController.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_GAME_BEGUN', gameBegun: this.getGameBegun({room_id})}))
        this.userController.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_ALIVE_PLAYERS', alivePlayers: this.getAlivePlayers({room_id})}))
        this.userController.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_WHO_TOOK_CARD', whoTookCard: this.getWhoTookCard({room_id})}))
        this.userController.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_PYRAMID_PLAYERS', pyramidPlayers: this.getPyramidPlayers({room_id})}))
        this.userController.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_ACTIONS_STACK', actionsStack: this.getActionsStack({room_id})}))
    }

    /** STATE SETTERS AND GETTERS */
    setGameBegun({ room_id, gameBegun }) {
        this.rooms_state[room_id].gameBegun = gameBegun
        this.room_broadcast(room_id, {protocol: 'SET_GAME_BEGUN', gameBegun})
    }
    getGameBegun({room_id}) {
        return this.rooms_state[room_id].gameBegun
    }
    
    setAlivePlayers({room_id, alivePlayers}){
        this.rooms_state[room_id].alivePlayers = alivePlayers
        this.room_broadcast(room_id, {protocol: 'SET_ALIVE_PLAYERS', alivePlayers})
    }
    getAlivePlayers({room_id}){
        return this.rooms_state[room_id].alivePlayers
    }
    
    setWhoTookCard({room_id, whoTookCard}) {
        this.rooms_state[room_id].whoTookCard = whoTookCard
        this.room_broadcast(room_id, {protocol: 'SET_WHO_TOOK_CARD', whoTookCard})
    }
    getWhoTookCard({room_id}){
        return this.rooms_state[room_id].whoTookCard
    }
    
    setPyramidPlayers({room_id, pyramidPlayers}){
        this.rooms_state[room_id].pyramidPlayers = pyramidPlayers
        this.room_broadcast(room_id, {protocol: 'SET_PYRAMID_PLAYERS', pyramidPlayers})
    }
    getPyramidPlayers({room_id}){
        return this.rooms_state[room_id].pyramidPlayers
    }
    
    setActionsStack({room_id, actionsStack}){
        this.rooms_state[room_id].actionsStack = actionsStack
        this.room_broadcast(room_id, {protocol: 'SET_ACTIONS_STACK', actionsStack})
    }
    getActionsStack({room_id}){
        return this.rooms_state[room_id].actionsStack
    }
}

module.exports = {MemoryRoomController}