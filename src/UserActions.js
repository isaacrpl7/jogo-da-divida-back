const { isBadObstacleCard, isBonusObstacleCard } = require("./utils")

class UserActions {
    constructor(userController, roomController){
        this.userController = userController
        this.roomController = roomController
    }

    drawCard({user_token, room_id, card, user_name}){
        if(isBadObstacleCard(card) || isBonusObstacleCard(card)){
            this.userController.setMyCurrentObstacle({user_token, myCurrentObstacle: card})

            // Se for carta do presente misterioso
            if(this.userController.getMyCurrentObstacle({user_token}) === 83 || this.userController.getMyCurrentObstacle({user_token}) === 84) {
                this.userController.setMysteriousPresent({user_token, mysteriousPresent: true})
            } else {
                this.userController.setMysteriousPresent({user_token, mysteriousPresent: false})
            }

            // Se for carta de esquema de pirâmide, mas já tenho esquema de pirâmide
            if(this.userController.getMyCurrentObstacle({user_token}) >= 26 && 
            this.userController.getMyCurrentObstacle({user_token}) <= 30 && this.roomController.getPyramidPlayers({room_id}).includes(user_name)) {

                this.userController.setTransferPyramidVisible({user_token, transferPyramidVisible: true})
            }
        } else {
            this.userController.setMyHand({user_token, myHand: [...this.userController.getMyHand({user_token}), card]})
        }
    }
}

module.exports = {UserActions}