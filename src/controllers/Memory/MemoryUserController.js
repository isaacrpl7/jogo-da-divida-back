const { v4: uuidv4 } = require('uuid');

class MemoryUserController {
    constructor() {
        this.users = {
            //user_token: {
            //    'ws': WebSocket Connection,
            //    name: name of the user,
            //    room_id: current_room_id,
            //    connected: true
            //}
        }
        this.users_state = {
            // user_token: {
            //     myHand,
            //     myTurn,
            //     myCurrentObstacle,
            //     takenCard,
            //     theirTurn,
            //     mysteriousPresent,
            //     noNeedToDrawCard,
            //     transferPyramidVisible,
            // }
        }
    }
    
    createUser({ name, ws }){
        const token = uuidv4()
        this.users = {
            ...this.users,
            [`${token}`]: {
                ws,
                name,
                connected: true,
                room_id: null
            }
        }
        this.users_state = {
            ...this.users_state,
            [token]: {
                myHand: [],
                myTurn: false,
                myCurrentObstacle: null,
                takenCard: null,
                theirTurn: '',
                mysteriousPresent: false,
                noNeedToDrawCard: false,
                transferPyramidVisible: false
            }
        }
        return token
    }

    printAllUsers() {
        console.log('TODOS OS USUARIOS:')
        Object.keys(this.users).forEach((user) => {
            console.log(`${user} possui o nome ${this.users[user].name}`)
        })
    }

    getUserState({user_token}) {
        return this.users_state[user_token]
    }

    checkUserAlreadyExists({user_token}){
        if(!user_token || this.users[user_token] === undefined) {
            return false
        }
        return true
    }

    getUser({user_token}){
        if(this.users[user_token] === undefined){
            return null
        }
        return this.users[user_token]
    }

    setUserRoom({user_token, room_id}){
        if(this.users[user_token] === undefined){
            throw Error('User does not exist!')
        }
        this.users[user_token].room_id = room_id
    }

    getUserRoom({user_token}){
        const user_room = this.users[user_token].room_id
        return user_room
    }

    getUserConnection({user_token}){
        return this.users[user_token].ws
    }

    disconnectUser({ user_token }) {
        this.users[user_token].connected = false
    }

    connectUser({user_token, ws}){
        this.users[user_token].connected = true
        this.users[user_token].ws = ws
    }

    sendState({user_token}){
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_HAND', myHand: this.getMyHand({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_TURN', myTurn: this.getMyTurn({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_CURRENT_OBSTACLE', myCurrentObstacle: this.getMyCurrentObstacle({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_TAKEN_CARD', takenCard: this.getTakenCard({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_THEIR_TURN', theirTurn: this.getTheirTurn({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MYSTERIOUS_PRESENT', mysteriousPresent: this.getMysteriousPresent({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_NO_NEED_TO_DRAW_CARD', noNeedToDrawCard: this.getNoNeedToDrawCard({user_token})}))
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_TRANSFER_PYRAMID_VISIBLE', transferPyramidVisible: this.getTransferPyramidVisible({user_token})}))
    }

    removeUser({ user_token }) {
        delete this.users[user_token]
        delete this.users_state[user_token]
    }

    /** GETTERS AND SETTERS */
    setMyHand({user_token, myHand}){
        this.users_state[user_token].myHand = myHand
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_HAND', myHand}))
    }
    getMyHand({user_token}) {
        return this.users_state[user_token].myHand
    }

    setMyTurn({user_token, myTurn}){
        this.users_state[user_token].myTurn = myTurn
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_TURN', myTurn}))
    }
    getMyTurn({user_token}){
        return this.users_state[user_token]
    }

    setMyCurrentObstacle({user_token, myCurrentObstacle}){
        this.users_state[user_token].myCurrentObstacle = myCurrentObstacle
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MY_CURRENT_OBSTACLE', myCurrentObstacle}))
    }
    getMyCurrentObstacle({user_token}){
        return this.users_state[user_token].myCurrentObstacle
    }

    setTakenCard({user_token, takenCard}){
        this.users_state[user_token].takenCard = takenCard
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_TAKEN_CARD', takenCard}))
    }
    getTakenCard({user_token}){
        return this.users_state[user_token].takenCard
    }

    setTheirTurn({user_token, theirTurn}){
        this.users_state[user_token].theirTurn = theirTurn
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_THEIR_TURN', theirTurn}))
    }
    getTheirTurn({user_token}){
        return this.users_state[user_token].theirTurn
    }

    setMysteriousPresent({user_token, mysteriousPresent}){
        this.users_state[user_token].mysteriousPresent = mysteriousPresent
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_MYTERIOUS_PRESENT', mysteriousPresent}))
    }
    getMysteriousPresent({user_token}){
        return this.users_state[user_token].mysteriousPresent
    }

    setNoNeedToDrawCard({user_token, noNeedToDrawCard}){
        this.users_state[user_token].noNeedToDrawCard = noNeedToDrawCard
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_NO_NEED_TO_DRAW_CARD', noNeedToDrawCard}))
    }
    getNoNeedToDrawCard({user_token}){
        return this.users_state[user_token].noNeedToDrawCard
    }

    setTransferPyramidVisible({user_token, transferPyramidVisible}){
        this.users_state[user_token].transferPyramidVisible = transferPyramidVisible
        this.getUserConnection({user_token}).send(JSON.stringify({protocol: 'SET_TRANSFER_PYRAMID_VISIBLE', transferPyramidVisible}))
    }
    getTransferPyramidVisible({user_token}){
        return this.users_state[user_token].transferPyramidVisible
    }
}

module.exports = {MemoryUserController}