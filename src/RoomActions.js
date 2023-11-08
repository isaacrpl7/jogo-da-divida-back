class RoomActions {
    constructor(userController, roomController, turn_per_room, cards_per_room) {
        this.userController = userController
        this.roomController = roomController
        this.turn_per_room = turn_per_room
        this.cards_per_room = cards_per_room
    }

    userLeftRoom({user_token, room_id}){
        this.roomController.removeUserFromRoom({user_token, room_id})
        // Delete the user that got out from the turn (if game has already started)
        const user_name = this.userController.getUser({user_token}).name
        if(this.turn_per_room[room_id]) {
            const index_user_in_turn = this.turn_per_room[room_id].indexOf(user_name)
            this.turn_per_room[room_id].splice(index_user_in_turn, 1)
        }

        const roomUsers = this.roomController.getArrUsersNamesInRoom({room_id})

        console.log(`Usuário ${user_name} foi removido da sala ${room_id}`)
        this.roomController.setAlivePlayers({room_id, alivePlayers: roomUsers})
        this.roomController.setRoomUsers({room_id, roomUsers: roomUsers})
        this.roomController.room_broadcast(room_id, {protocol: 'USER_LEFT', 
        users: roomUsers.map((user) => `${user}`), user_leaving: user_name})

        // Próximo admin (somente se o admin principal saiu)
        const admin_token = this.roomController.getRoomAdminToken({room_id})
        if(roomUsers.length > 0 && admin_token === user_token) {
            const next_room_admin = this.roomController.getUserTokenByName({user_name: roomUsers[0], room_id})
            this.roomController.setRoomAdminToken({room_id, roomAdminToken: next_room_admin})
        }
        setTimeout(() => {
            if(this.roomController.checkRoomAlreadyExists({room_id}) && roomUsers.length === 0) {
                this.roomController.removeRoom({room_id})
                delete this.cards_per_room[room_id]
                delete this.turn_per_room[room_id]
                console.log(`Sala ${room_id} foi excluída por estar vazia`)
            }
        }, 5000)
    }

    userReenteredRoomWithDifferentName({user_token, room_id, new_user_name}) {
        const user_name = this.userController.getUser({user_token}).name
        this.userController.setUserName({user_token, user_name: new_user_name})

        const roomUsers = this.roomController.getArrUsersNamesInRoom({room_id})

        this.roomController.setAlivePlayers({room_id, alivePlayers: roomUsers})
        this.roomController.setRoomUsers({room_id, roomUsers: roomUsers})
        console.log(`Usuário ${user_name} saiu da sala ${room_id} e reentrou como ${new_user_name}`)
    }

    userEnterRoom({user_token, room_id, user_name, ws}){
        if(!this.roomController.checkRoomAlreadyExists({room_id})) {// Se a sala não existe
            ws.send(JSON.stringify({protocol: 'ENTER_ROOM_FAILED', msg: 'Sala não existe'}))
        } else {
            // Se a sala que está entrando for uma sala diferente da atual
            const last_user_room = this.userController.getUserRoom({user_token})
            if(last_user_room !== room_id) {
                if(!this.roomController.getGameBegun({room_id})){
                    // Remove da ultima sala (se ele ainda estivesse em alguma)
                    if(last_user_room){
                        this.userLeftRoom({user_token, room_id: last_user_room})
                    }
                    // Adiciona na nova
                    this.roomController.addUserToRoom({room_id, user_token})
                } else {
                    ws.send(JSON.stringify({protocol: 'ENTER_ROOM_FAILED', msg: 'Jogo já começou!'}))
                }
            } else { //Se estiver reentrando na mesma sala, é pq está reconectando
                //ADICIONAR UMA CONDIÇÃO DO USUÁRIO RECONECTAR SEM MUDAR DE NOME ENVIAR PARA ELE AS PESSOAS DA SALA
                const gameStarted = this.roomController.getGameBegun({room_id: this.userController.getUserRoom({user_token})});
                const userChangedName = user_name !== this.userController.getUser({user_token}).name;

                if(userChangedName && gameStarted){// Se o usuário mudou o nome, e o jogo já iniciou em sua sala
                    ws.send(JSON.stringify({protocol: 'ENTER_ROOM_FAILED', msg: 'Não mude o nome de usuário ao reentrar em uma sala que o jogo já começou!'}))
                }
                if(!gameStarted && userChangedName){// Se o jogo nao começou e ele mudou o nome
                    this.userReenteredRoomWithDifferentName({user_token, new_user_name: user_name, room_id})
                }
                
                this.userController.connectUser({user_token, ws})
                this.userController.sendState({user_token})
                this.roomController.sendRoomStateToUser({room_id: this.userController.getUserRoom({user_token}), user_token})
            }
        }
    }
}

module.exports = {RoomActions}