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

        console.log(`Usuário ${user_name} foi removido da sala ${room_id}`)
        this.roomController.setAlivePlayers({room_id, alivePlayers: this.roomController.getArrUsersNamesInRoom({room_id})})
        this.roomController.room_broadcast(room_id, {protocol: 'USER_LEFT', 
        users: this.roomController.getArrUsersNamesInRoom({room_id}).map((user) => `${user}`), user_leaving: user_name})
        setTimeout(() => {
            if(this.roomController.checkRoomAlreadyExists({room_id}) && this.roomController.getArrUsersNamesInRoom({room_id}).length === 0) {
                this.roomController.removeRoom({room_id})
                delete this.cards_per_room[room_id]
                delete this.turn_per_room[room_id]
                console.log(`Sala ${room_id} foi excluída por estar vazia`)
            }
        }, 5000)
    }
}

module.exports = {RoomActions}