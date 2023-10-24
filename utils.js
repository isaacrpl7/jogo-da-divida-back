function generateRoomId(idLength=6) {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < idLength) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
}

// If the last player is somewhere in the next turns, delete the last player from the turn buffer
function returnToNormalTurn(turn) {
    const last_player = turn[1]
    turn.forEach((player, index) => {
        if(index > 1 && player === last_player){
            turn.splice(1,1)
        }
    });
    return turn
}

module.exports = {generateRoomId, shuffle, returnToNormalTurn}